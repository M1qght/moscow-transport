import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Database } from './database';

export function blendPrediction(historical: number | null, previous: number | null) {
  if (historical === null && previous === null) return null;
  const value =
    historical === null
      ? previous!
      : previous === null
        ? historical
        : 0.6 * historical + 0.4 * previous;
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}
export const moscowHour = (time: Date) => (time.getUTCHours() + 3) % 24;

@Injectable()
export class PredictionService {
  constructor(@Inject(Database) private db: Database) {}
  async aggregateCurrentLoad(stopId: string, routeId: string, time = new Date()) {
    const result = await this.db.report.aggregate({
      where: {
        stopId,
        routeId,
        status: { not: 'REJECTED' },
        createdAt: { gte: new Date(time.getTime() - 20 * 60000), lte: time },
      },
      _avg: { load: true },
      _count: true,
      _max: { createdAt: true },
    });
    return {
      load: result._avg.load === null ? null : Math.round(result._avg.load * 10) / 10,
      samples: result._count,
      lastReportAt: result._max.createdAt,
      windowMinutes: 20,
    };
  }
  async calculatePrediction(stopId: string, routeId: string, time = new Date()) {
    const position = await this.db.routeStop.findUnique({
      where: { routeId_stopId: { routeId, stopId } },
    });
    if (!position) throw new NotFoundException('Остановка не относится к маршруту');
    const previous = await this.db.routeStop.findUnique({
      where: { routeId_order: { routeId, order: position.order - 1 } },
    });
    // История не пересекается с текущим окном. Час всегда московский, независимо от TZ сервера.
    const history = await this.db.$queryRaw<{ average: number | null; samples: bigint }[]>`
      SELECT AVG(load)::float8 AS average, COUNT(*) AS samples FROM reports
      WHERE "stopId" = ${stopId} AND "routeId" = ${routeId} AND status != 'REJECTED'
        AND "createdAt" >= ${new Date(time.getTime() - 28 * 86400000)}
        AND "createdAt" < ${new Date(time.getTime() - 20 * 60000)}
        AND EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Moscow')) = ${moscowHour(time)}
    `;
    const latest = previous
      ? await this.db.report.findFirst({
          where: {
            stopId: previous.stopId,
            routeId,
            status: { not: 'REJECTED' },
            createdAt: { gte: new Date(time.getTime() - 20 * 60000), lte: time },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : null;
    const historical = history[0]?.average ?? null;
    return {
      load: blendPrediction(historical, latest?.load ?? null),
      historical,
      historySamples: Number(history[0]?.samples ?? 0),
      previousLoad: latest?.load ?? null,
      previousReportAt: latest?.createdAt ?? null,
      confidence:
        historical !== null && latest
          ? 'combined'
          : historical !== null
            ? 'history'
            : latest
              ? 'previous'
              : 'no-data',
      weights: { historical: 0.6, previous: 0.4 },
    };
  }
}
