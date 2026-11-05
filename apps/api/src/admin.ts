import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard, AuthGuard, AuthRequest } from './auth';
import { Database } from './database';
import { id, pagination, parse, publicUser } from './validation';

@Controller('admin') @UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(@Inject(Database) private db: Database) {}
  @Get('tickets')
  async tickets(@Query() query: unknown) {
    const p = pagination(query);
    const filters = parse(z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).optional(), type: z.enum(['COMPLAINT', 'QUESTION']).optional() }), query);
    const [items, total] = await Promise.all([this.db.ticket.findMany({ where: filters, skip: p.skip, take: p.take, orderBy: { createdAt: 'desc' }, include: { user: { select: publicUser } } }), this.db.ticket.count({ where: filters })]);
    return { items, total, page: p.page };
  }
  @Patch('tickets/:id')
  async updateTicket(@Req() req: AuthRequest, @Param('id') ticketId: string, @Body() body: unknown) {
    const data = parse(z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']), reply: z.string().trim().max(4000).optional() }).strict(), body);
    return this.db.$transaction(async tx => {
      if (!await tx.ticket.findUnique({ where: { id: parse(id, ticketId) } })) throw new NotFoundException();
      const ticket = await tx.ticket.update({ where: { id: ticketId }, data });
      await tx.adminLog.create({ data: { adminId: req.user.sub, action: 'TICKET_UPDATE', targetId: ticketId, details: data } });
      return ticket;
    });
  }
  @Get('reports')
  async reports(@Query() query: unknown) {
    const p = pagination(query);
    const where = parse(z.object({ userId: id.optional(), status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED']).optional() }), query);
    const [items, total] = await Promise.all([this.db.report.findMany({ where, skip: p.skip, take: p.take, orderBy: { createdAt: 'desc' }, include: { user: { select: publicUser }, stop: true, route: true } }), this.db.report.count({ where })]);
    return { items, total, page: p.page };
  }
  @Patch('reports/:id')
  async moderate(@Req() req: AuthRequest, @Param('id') reportId: string, @Body() body: unknown) {
    const data = parse(z.object({ status: z.enum(['CONFIRMED', 'REJECTED']), reason: z.string().trim().min(3).max(500) }).strict(), body);
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM reports WHERE id = ${parse(id, reportId)} FOR UPDATE`;
      const report = await tx.report.findUnique({ where: { id: reportId } });
      if (!report) throw new NotFoundException();
      if (report.status === data.status) return report;
      const scores = { PENDING: 0, CONFIRMED: 2, REJECTED: -3 };
      const delta = scores[data.status] - scores[report.status];
      const updated = await tx.report.update({ where: { id: reportId }, data: { status: data.status } });
      await tx.user.update({ where: { id: report.userId }, data: { rating: { increment: delta } } });
      await tx.ratingHistory.create({ data: { userId: report.userId, reportId, delta, reason: data.reason } });
      await tx.adminLog.create({ data: { adminId: req.user.sub, action: 'REPORT_MODERATE', targetId: reportId, details: { ...data, previous: report.status, delta } } });
      return updated;
    });
  }
  @Get('users')
  users(@Query() query: unknown) {
    const p = pagination(query);
    const { q } = parse(z.object({ q: z.string().max(100).optional() }), query);
    return this.db.user.findMany({ where: q ? { OR: [{ login: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] } : {}, select: publicUser, skip: p.skip, take: p.take, orderBy: { createdAt: 'desc' } });
  }
  @Patch('users/:id/rating')
  rating(@Req() req: AuthRequest, @Param('id') userId: string, @Body() body: unknown) {
    const data = parse(z.object({ delta: z.number().int().min(-100).max(100).refine(n => n !== 0), reason: z.string().trim().min(3).max(500) }).strict(), body);
    return this.db.$transaction(async tx => {
      if (!await tx.user.findUnique({ where: { id: parse(id, userId) } })) throw new NotFoundException();
      const user = await tx.user.update({ where: { id: userId }, data: { rating: { increment: data.delta } }, select: publicUser });
      await tx.ratingHistory.create({ data: { userId, ...data } });
      await tx.adminLog.create({ data: { adminId: req.user.sub, action: 'RATING_ADJUST', targetId: userId, details: data } });
      return user;
    });
  }
  @Get('logs')
  logs(@Query() query: unknown) { const p = pagination(query); return this.db.adminLog.findMany({ take: p.take, skip: p.skip, orderBy: { createdAt: 'desc' }, include: { admin: { select: publicUser } } }); }
  @Get('anomalies')
  async anomalies() {
    // Сигнал для модератора, а не автоматический приговор пользователю.
    const reports = await this.db.$queryRaw<{ id: string; userId: string; stopId: string; routeId: string; load: number; previousLoad: number | null; createdAt: Date }[]>`
      SELECT * FROM (
        SELECT id, "userId", "stopId", "routeId", load, "createdAt",
          LAG(load) OVER (PARTITION BY "stopId", "routeId" ORDER BY "createdAt", id) AS "previousLoad"
        FROM reports WHERE "createdAt" > NOW() - INTERVAL '1 day' AND status != 'REJECTED'
      ) r WHERE ABS(load - "previousLoad") >= 50 ORDER BY "createdAt" DESC LIMIT 100`;
    const spam = await this.db.$queryRaw<{ userId: string; count: number }[]>`
      SELECT "userId", COUNT(*)::int AS count FROM reports
      WHERE "createdAt" > NOW() - INTERVAL '10 minutes'
      GROUP BY "userId" HAVING COUNT(*) >= 5 LIMIT 100`;
    return { jumps: reports, spam };
  }
}
