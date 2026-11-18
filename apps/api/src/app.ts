import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Database } from './database';
import { AuthController, AuthService, AuthGuard, AdminGuard } from './auth';
import { TransportController } from './transport';
import { ReportsController } from './reports';
import { AdminController } from './admin';
import { PredictionService } from './prediction.service';

@Module({
  imports: [JwtModule.register({}), ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [AuthController, TransportController, ReportsController, AdminController],
  providers: [
    Database,
    AuthService,
    AuthGuard,
    AdminGuard,
    PredictionService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
