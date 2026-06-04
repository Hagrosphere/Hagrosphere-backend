import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

/**
 * Background jobs that run on a schedule.
 * These keep the database clean and statistics fresh.
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every day at 2am: purge expired/revoked refresh tokens older than 7 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeExpiredTokens() {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: cutoff } },
        ],
      },
    });
    this.logger.log(`Cron: purged ${result.count} expired refresh tokens`);
  }

  /**
   * Every day at 3am: soft-close jobs past their deadline
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async closeExpiredJobs() {
    const result = await this.prisma.job.updateMany({
      where: {
        status: 'OPEN',
        deadline: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: 'CLOSED' },
    });
    this.logger.log(`Cron: closed ${result.count} expired job postings`);
  }

  /**
   * Every hour: update cached dashboard stats
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshDashboardStats() {
    const [totalUsers, totalEquipment, totalJobs, totalArticles] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.equipment.count({ where: { deletedAt: null } }),
        this.prisma.job.count({ where: { status: 'OPEN', deletedAt: null } }),
        this.prisma.article.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      ]);

    await this.prisma.dashboardStat.upsert({
      where: { key: 'quick_stats' },
      create: {
        key: 'quick_stats',
        value: { totalUsers, totalEquipment, totalJobs, totalArticles } as any,
      },
      update: {
        value: { totalUsers, totalEquipment, totalJobs, totalArticles } as any,
      },
    });

    this.logger.log('Cron: dashboard stats refreshed');
  }

  /**
   * Weekly Sunday midnight: archive old unread contact messages (> 90 days)
   */
  @Cron('0 0 * * 0')
  async archiveOldMessages() {
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000);
    const result = await this.prisma.contactMessage.updateMany({
      where: {
        status: 'UNREAD',
        createdAt: { lt: cutoff },
      },
      data: { status: 'ARCHIVED' },
    });
    this.logger.log(`Cron: archived ${result.count} old contact messages`);
  }
}
