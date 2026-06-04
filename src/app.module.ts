import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { AppConfig } from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './config/redis.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { ContactModule } from './modules/contact/contact.module';
import { AdminModule } from './modules/admin/admin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [AppConfig],
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
    }),

    // ── Rate Limiting ────────────────────────────────────────
    // Global: 200 req / 60s per IP. Auth routes override this.
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 200,
      },
    ]),

    // ── Scheduling (cron jobs) ────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Infrastructure ───────────────────────────────────────
    DatabaseModule,
    RedisModule,

    // ── Feature Modules ──────────────────────────────────────
    AuthModule,
    UsersModule,
    EquipmentModule,
    JobsModule,
    ArticlesModule,
    ContactModule,
    AdminModule,
    DashboardModule,
    UploadModule,
  ],
  providers: [
    // Apply rate-limiter globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
