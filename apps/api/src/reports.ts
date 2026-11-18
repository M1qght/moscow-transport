import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, AuthRequest } from './auth';
import { Database } from './database';
import { id, pagination, parse } from './validation';

@Controller()
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(Database) private db: Database) {}
  @Post('reports')
  async create(@Req() req: AuthRequest, @Body() body: unknown) {
    const data = parse(
      z
        .object({
          stopId: id,
          routeId: id,
          load: z.number().int().min(0).max(100),
          action: z.enum(['BOARDED', 'ALIGHTED', 'RIDING']),
        })
        .strict(),
      body,
    );
    return this.db.$transaction(async (tx) => {
      // Блокировка пользователя закрывает гонку антиспама даже между разными процессами API.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.sub} FOR UPDATE`;
      const routeStop = await tx.routeStop.findUnique({
        where: { routeId_stopId: { routeId: data.routeId, stopId: data.stopId } },
      });
      if (!routeStop) throw new NotFoundException('Маршрут не проходит через остановку');
      const cooldown = Number(process.env.REPORT_COOLDOWN_MINUTES ?? 5);
      const recent = await tx.report.findFirst({
        where: {
          userId: req.user.sub,
          stopId: data.stopId,
          createdAt: { gt: new Date(Date.now() - cooldown * 60000) },
        },
      });
      if (recent)
        throw new ConflictException(`На этой остановке можно отмечаться раз в ${cooldown} минут`);
      return tx.report.create({ data: { ...data, userId: req.user.sub } });
    });
  }
  @Get('me/reports')
  async history(@Req() req: AuthRequest, @Query() query: unknown) {
    const p = pagination(query);
    const where = { userId: req.user.sub };
    const [items, total] = await Promise.all([
      this.db.report.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
        include: { stop: true, route: true },
      }),
      this.db.report.count({ where }),
    ]);
    return { items, total, page: p.page };
  }
  @Get('me/ratings')
  ratings(@Req() req: AuthRequest, @Query() query: unknown) {
    const p = pagination(query);
    return this.db.ratingHistory.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      skip: p.skip,
      take: p.take,
    });
  }
  @Post('tickets')
  ticket(@Req() req: AuthRequest, @Body() body: unknown) {
    const data = parse(
      z
        .object({
          type: z.enum(['COMPLAINT', 'QUESTION']),
          subject: z.string().trim().min(3).max(120),
          body: z.string().trim().min(10).max(4000),
        })
        .strict(),
      body,
    );
    return this.db.ticket.create({ data: { ...data, userId: req.user.sub } });
  }
  @Get('me/tickets')
  tickets(@Req() req: AuthRequest, @Query() query: unknown) {
    const p = pagination(query);
    return this.db.ticket.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
      skip: p.skip,
      take: p.take,
    });
  }
}
