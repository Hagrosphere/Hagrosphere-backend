import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this.$on as any)('query', (e: any) => {
        if (e.duration > 200) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    // Soft-delete middleware — automatically filters out deleted records
    this.$use(async (params, next) => {
      const softDeleteModels = ['User', 'Equipment', 'Job', 'Article'];

      if (softDeleteModels.includes(params.model ?? '')) {
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          params.args.where = { ...params.args.where, deletedAt: null };
        }

        if (params.action === 'findMany') {
          params.args = params.args ?? {};
          params.args.where = { ...params.args.where, deletedAt: null };
        }

        // Soft delete: set deletedAt instead of actually deleting
        if (params.action === 'delete') {
          params.action = 'update';
          params.args.data = { deletedAt: new Date() };
        }

        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          params.args.data = { deletedAt: new Date() };
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected ✓');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Health check used by /health endpoint
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
