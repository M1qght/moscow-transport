import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app';
import { configureApp } from './bootstrap';

config({ path: resolve(__dirname, '../../../.env') });
for (const name of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[name] || (name.startsWith('JWT') && process.env[name]!.length < 32)) throw new Error(`Проверьте ${name} в .env`);
}
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('JWT secrets должны отличаться');
const cooldown = Number(process.env.REPORT_COOLDOWN_MINUTES ?? 5);
if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 60) throw new Error('REPORT_COOLDOWN_MINUTES: целое число 1–60');
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
}
void bootstrap();
