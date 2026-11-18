import { Controller, Get, Inject, NotFoundException, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { Database } from './database';
import { PredictionService } from './prediction.service';
import { id, parse } from './validation';

@Controller()
export class TransportController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(PredictionService) private prediction: PredictionService,
  ) {}
  @Get('health') async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
  @Get('stops')
  stops(@Query() query: unknown) {
    const q = parse(
      z.object({
        q: z.string().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(500),
      }),
      query,
    );
    return this.db.stop.findMany({
      where: q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      take: q.limit,
      include: { routeStops: { include: { route: true }, orderBy: { order: 'asc' } } },
    });
  }
  @Get('routes/:id')
  async route(@Param('id') routeId: string) {
    const route = await this.db.route.findUnique({
      where: { id: parse(id, routeId) },
      include: { stops: { orderBy: { order: 'asc' }, include: { stop: true } } },
    });
    if (!route) throw new NotFoundException('Маршрут не найден');
    return route;
  }
  @Get('stops/:id/load')
  async load(@Param('id') stopId: string, @Query() query: unknown) {
    const { routeId } = parse(z.object({ routeId: id }), query);
    const position = await this.db.routeStop.findUnique({
      where: { routeId_stopId: { routeId, stopId: parse(id, stopId) } },
    });
    if (!position) throw new NotFoundException('Маршрут не проходит через остановку');
    const next = await this.db.routeStop.findUnique({
      where: { routeId_order: { routeId, order: position.order + 1 } },
      include: { stop: true },
    });
    const [current, prediction] = await Promise.all([
      this.prediction.aggregateCurrentLoad(stopId, routeId),
      next ? this.prediction.calculatePrediction(next.stopId, routeId) : Promise.resolve(null),
    ]);
    return { current, nextStop: next?.stop ?? null, prediction };
  }
}
