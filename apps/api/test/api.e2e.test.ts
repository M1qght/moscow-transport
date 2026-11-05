import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app';
import { Database } from '../src/database';
import { configureApp } from '../src/bootstrap';

config({ path: resolve(process.cwd(), '../../.env') });
const key = `e2e_${randomUUID().slice(0, 8)}`;
let app: INestApplication; let db: Database;
let userId = ''; let adminId = ''; let token = ''; let adminToken = ''; let refreshCookie = ''; let reportId = '';
const routeId = `${key}_route`; const stopId = `${key}_stop`; const nextId = `${key}_next`;
describe('REST + PostgreSQL', () => {
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init(); db = app.get(Database);
    await db.stop.createMany({ data: [{ id: stopId, name: 'Тестовая', lat: 55.75, lon: 37.6, source: 'TEST' }, { id: nextId, name: 'Следующая', lat: 55.76, lon: 37.6, source: 'TEST' }] });
    await db.route.create({ data: { id: routeId, number: 'test', title: 'API test', type: 'BUS', source: 'TEST', stops: { create: [{ stopId, order: 0 }, { stopId: nextId, order: 1 }] } } });
    const admin = await db.user.create({ data: { login: `${key}_admin`, name: 'Тестовый модератор', role: 'ADMIN', passwordHash: await argon2.hash('test_password') } }); adminId = admin.id;
    const result = await request(app.getHttpServer()).post('/api/auth/login').send({ login: admin.login, password: 'test_password' }).expect(201); adminToken = result.body.accessToken;
  });
  afterAll(async () => {
    if (db) {
      const ids = [userId, adminId].filter(Boolean);
      await db.adminLog.deleteMany({ where: { adminId: { in: ids } } });
      await db.ratingHistory.deleteMany({ where: { userId: { in: ids } } });
      await db.ticket.deleteMany({ where: { userId: { in: ids } } });
      await db.report.deleteMany({ where: { routeId } });
      await db.route.deleteMany({ where: { id: routeId } });
      await db.stop.deleteMany({ where: { id: { in: [stopId, nextId] } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });
  it('registers, validates input, rejects duplicates and protects admin', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send({ login: '!', name: 'I', password: 'x' }).expect(400);
    const result = await request(app.getHttpServer()).post('/api/auth/register').send({ login: key, name: 'Ivan', password: 'test_password' }).expect(201);
    userId = result.body.user.id; token = result.body.accessToken; refreshCookie = result.headers['set-cookie'][0].split(';')[0];
    expect(result.body.user.passwordHash).toBeUndefined();
    await request(app.getHttpServer()).post('/api/auth/register').send({ login: key, name: 'Ivan', password: 'test_password' }).expect(409);
    await request(app.getHttpServer()).get('/api/admin/reports').expect(401);
    await request(app.getHttpServer()).get('/api/admin/reports').auth(token, { type: 'bearer' }).expect(403);
  });
  it('checks route membership, range and concurrent cooldown', async () => {
    const body = { stopId, routeId, load: 10, action: 'RIDING' };
    await request(app.getHttpServer()).post('/api/reports').auth(token, { type: 'bearer' }).send({ ...body, load: 101 }).expect(400);
    await request(app.getHttpServer()).post('/api/reports').auth(token, { type: 'bearer' }).send({ ...body, routeId: 'missing' }).expect(404);
    const results = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post('/api/reports').auth(token, { type: 'bearer' }).send(body)));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]); reportId = results.find(r => r.status === 201)!.body.id;
    await db.report.createMany({ data: [5, 15].map(load => ({ userId: adminId, stopId, routeId, load, action: 'RIDING' as const })) });
    const history = new Date(Date.now() - 86400000);
    await db.report.create({ data: { userId: adminId, stopId: nextId, routeId, load: 40, action: 'RIDING', createdAt: history } });
    const result = await request(app.getHttpServer()).get(`/api/stops/${stopId}/load?routeId=${routeId}`).expect(200);
    expect(result.body.current).toMatchObject({ load: 10, samples: 3 });
    expect(result.body.prediction.historical).toBe(40); expect(result.body.prediction.historySamples).toBe(1);
    expect(result.body.prediction.load).toBeGreaterThanOrEqual(26); expect(result.body.prediction.load).toBeLessThanOrEqual(30);
  });
  it('moderates idempotently, reverses score and excludes rejected reports', async () => {
    const endpoint = `/api/admin/reports/${reportId}`;
    const patch = (status: string) => request(app.getHttpServer()).patch(endpoint).auth(adminToken, { type: 'bearer' }).send({ status, reason: 'Проверено модератором' }).expect(200);
    await patch('CONFIRMED'); await patch('CONFIRMED');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).rating).toBe(2);
    await patch('REJECTED'); expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).rating).toBe(-3);
    expect(await db.ratingHistory.count({ where: { userId } })).toBe(2);
    const result = await request(app.getHttpServer()).get(`/api/stops/${stopId}/load?routeId=${routeId}`).expect(200);
    expect(result.body.current.samples).toBe(2);
    await request(app.getHttpServer()).patch(`/api/admin/users/${userId}/rating`).auth(adminToken, { type: 'bearer' }).send({ delta: 5, reason: 'Полезная активность' }).expect(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).rating).toBe(2);
  });
  it('supports tickets, answers and ownership boundaries', async () => {
    const result = await request(app.getHttpServer()).post('/api/tickets').auth(token, { type: 'bearer' }).send({ type: 'QUESTION', subject: 'Как работает прогноз?', body: 'Хочу узнать, откуда берутся данные для прогноза.' }).expect(201);
    await request(app.getHttpServer()).patch(`/api/admin/tickets/${result.body.id}`).auth(adminToken, { type: 'bearer' }).send({ status: 'CLOSED', reply: 'История плюс свежие отметки.' }).expect(200);
    const mine = await request(app.getHttpServer()).get('/api/me/tickets').auth(token, { type: 'bearer' }).expect(200);
    expect(mine.body[0].reply).toBe('История плюс свежие отметки.');
    await request(app.getHttpServer()).get('/api/admin/anomalies').auth(adminToken, { type: 'bearer' }).expect(200);
    expect(await db.adminLog.count({ where: { adminId } })).toBe(4);
  });
  it('rotates refresh JWT, blocks replay, CSRF and logout reuse', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', refreshCookie).expect(403);
    const result = await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', refreshCookie).expect(201);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', refreshCookie).expect(401);
    const cookie = result.headers['set-cookie'][0].split(';')[0];
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie', cookie).expect(201);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });
});
