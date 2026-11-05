import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const db = new PrismaClient();
async function main() {
  const login = process.env.SEED_ADMIN_LOGIN;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!login || !password || password.length < 8) throw new Error('Задайте SEED_ADMIN_LOGIN и SEED_ADMIN_PASSWORD (8+ символов)');
  await db.user.upsert({ where: { login }, update: {}, create: { login, name: 'Администратор', role: 'ADMIN', passwordHash: await argon2.hash(password) } });
  if (process.env.SEED_DEMO !== 'true') return;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 8) throw new Error('Задайте SEED_DEMO_PASSWORD');
  const ivan = await db.user.upsert({ where: { login: 'ivan' }, update: {}, create: { login: 'ivan', name: 'Ivan', passwordHash: await argon2.hash(demoPassword) } });
  const anna = await db.user.upsert({ where: { login: 'anna' }, update: {}, create: { login: 'anna', name: 'Анна', passwordHash: await argon2.hash(demoPassword) } });
  const stops = [
    ['demo-chistye', 'Метро «Чистые пруды»', 55.7645, 37.6386],
    ['demo-pokrovskie', 'Покровские ворота', 55.7584, 37.6467],
    ['demo-kazarmenny', 'Казарменный переулок', 55.7546, 37.6489],
    ['demo-yauzskie', 'Яузские ворота', 55.7505, 37.6445],
    ['demo-solянka', 'Солянка', 55.7524, 37.6378],
    ['demo-lubyanka', 'Лубянская площадь', 55.7594, 37.6283],
  ] as const;
  for (const [id, name, lat, lon] of stops) await db.stop.upsert({ where: { id }, update: {}, create: { id, name, lat, lon, source: 'DEMO' } });
  for (const [routeId, number, type, stopIds] of [
    ['demo-tram-a', 'А', 'TRAM', stops.slice(0, 4).map(s => s[0])],
    ['demo-bus-m3', 'м3', 'BUS', [stops[5][0], stops[4][0], stops[3][0], stops[2][0]]],
  ] as const) {
    await db.route.upsert({ where: { id: routeId }, update: {}, create: { id: routeId, number, type, title: 'Учебное направление • центр Москвы', source: 'DEMO' } });
    for (const [order, stopId] of stopIds.entries()) await db.routeStop.upsert({ where: { routeId_stopId: { routeId, stopId } }, update: {}, create: { routeId, stopId, order } });
  }
  // Стабильные id делают повторный seed безопасным. Чужие отметки не трогаем.
  for (let day = 1; day <= 14; day++) {
    for (let stop = 0; stop < 4; stop++) {
      const createdAt = new Date(Date.now() - day * 86400000);
      await db.report.upsert({ where: { id: `demo-history-${day}-${stop}` }, update: {}, create: { id: `demo-history-${day}-${stop}`, userId: day % 2 ? ivan.id : anna.id, stopId: stops[stop][0], routeId: 'demo-tram-a', load: 25 + stop * 12 + (day % 5) * 3, action: 'RIDING', isDemo: true, createdAt } });
    }
  }
  for (const [index, load] of [5, 10, 15].entries()) await db.report.upsert({ where: { id: `demo-current-${index}` }, update: {}, create: { id: `demo-current-${index}`, userId: index % 2 ? ivan.id : anna.id, stopId: stops[0][0], routeId: 'demo-tram-a', load, action: 'RIDING', isDemo: true, createdAt: new Date(Date.now() - (index + 1) * 60000) } });
  await db.ticket.upsert({ where: { id: 'demo-ticket' }, update: {}, create: { id: 'demo-ticket', userId: ivan.id, type: 'QUESTION', subject: 'Как считается прогноз?', body: 'Почему прогноз на следующей остановке отличается от текущей загрузки?' } });
  console.log('Seed готов. DEMO — учебные маршруты и синтетические отметки, не реальные данные о транспорте.');
}
main().finally(() => db.$disconnect());
