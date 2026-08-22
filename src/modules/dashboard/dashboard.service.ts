import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Single query for all counts — uses 1 connection instead of 10
    const [counts] = await this.prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(*) FROM users WHERE "deletedAt" IS NULL)::int AS "totalUsers",
        (SELECT COUNT(*) FROM users WHERE "createdAt" >= ${startOfMonth} AND "deletedAt" IS NULL)::int AS "usersThisMonth",
        (SELECT COUNT(*) FROM users WHERE "createdAt" >= ${startOfLastMonth} AND "createdAt" <= ${endOfLastMonth} AND "deletedAt" IS NULL)::int AS "usersLastMonth",
        (SELECT COUNT(*) FROM equipment WHERE "deletedAt" IS NULL)::int AS "totalEquipment",
        (SELECT COUNT(*) FROM equipment WHERE status = 'AVAILABLE' AND "deletedAt" IS NULL)::int AS "availableEquipment",
        (SELECT COUNT(*) FROM jobs WHERE "deletedAt" IS NULL)::int AS "totalJobs",
        (SELECT COUNT(*) FROM jobs WHERE status = 'OPEN' AND "deletedAt" IS NULL)::int AS "openJobs",
        (SELECT COUNT(*) FROM articles WHERE "deletedAt" IS NULL)::int AS "totalArticles",
        (SELECT COUNT(*) FROM articles WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL)::int AS "publishedArticles",
        (SELECT COUNT(*) FROM contact_messages WHERE status = 'UNREAD')::int AS "unreadMessages"
    `;

    const totalUsers = counts.totalUsers;
    const usersThisMonth = counts.usersThisMonth;
    const usersLastMonth = counts.usersLastMonth;
    const totalEquipment = counts.totalEquipment;
    const availableEquipment = counts.availableEquipment;
    const totalJobs = counts.totalJobs;
    const openJobs = counts.openJobs;
    const totalArticles = counts.totalArticles;
    const publishedArticles = counts.publishedArticles;
    const unreadMessages = counts.unreadMessages;

    // Batch 2: recent records (5 queries, sequential-friendly)
    const recentUsers = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true, status: true },
    });
    const recentEquipment = await this.prisma.equipment.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { category: { select: { name: true } }, images: { where: { isPrimary: true }, take: 1 } },
    });
    const recentJobs = await this.prisma.job.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { category: { select: { name: true } } },
    });
    const recentArticles = await this.prisma.article.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, viewCount: true, createdAt: true },
    });
    const recentContactMessages = await this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, name: true, email: true, subject: true, message: true, status: true, createdAt: true },
    });

    // Batch 3: growth chart (sequential)
    const userGrowth = await this.getUserGrowthLast6Months();

    const usersGrowthPct =
      usersLastMonth > 0
        ? ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100
        : usersThisMonth > 0 ? 100 : 0;

    return {
      stats: {
        users: { total: totalUsers, thisMonth: usersThisMonth, growthPercent: Math.round(usersGrowthPct * 10) / 10 },
        equipment: { total: totalEquipment, available: availableEquipment },
        jobs: { total: totalJobs, open: openJobs },
        articles: { total: totalArticles, published: publishedArticles },
        messages: { unread: unreadMessages },
      },
      charts: {
        userGrowth,
        contentBreakdown: { articles: totalArticles, jobs: totalJobs, equipment: totalEquipment },
      },
      recent: { users: recentUsers, equipment: recentEquipment, jobs: recentJobs, articles: recentArticles, contactMessages: recentContactMessages },
    };
  }

  async getActivityFeed(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);
    return { data: logs, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  private async getUserGrowthLast6Months() {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }).reverse();

    const result = [];
    for (const { year, month } of months) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const count = await this.prisma.user.count({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null },
      });
      result.push({ label: start.toLocaleString('default', { month: 'short', year: '2-digit' }), users: count });
    }
    return result;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async refreshCachedStats() {
    const overview = await this.getOverview();
    await this.prisma.dashboardStat.upsert({
      where: { key: 'overview' },
      create: { key: 'overview', value: overview as any },
      update: { value: overview as any },
    });
  }
}
