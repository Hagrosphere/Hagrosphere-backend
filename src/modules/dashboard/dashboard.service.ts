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
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers,
      usersThisMonth,
      usersLastMonth,
      totalEquipment,
      availableEquipment,
      totalJobs,
      openJobs,
      totalArticles,
      publishedArticles,
      unreadMessages,
      recentUsers,
      recentEquipment,
      recentJobs,
      recentArticles,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth }, deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }, deletedAt: null } }),
      this.prisma.equipment.count({ where: { deletedAt: null } }),
      this.prisma.equipment.count({ where: { status: 'AVAILABLE', deletedAt: null } }),
      this.prisma.job.count({ where: { deletedAt: null } }),
      this.prisma.job.count({ where: { status: 'OPEN', deletedAt: null } }),
      this.prisma.article.count({ where: { deletedAt: null } }),
      this.prisma.article.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
      this.prisma.contactMessage.count({ where: { status: 'UNREAD' } }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true, status: true },
      }),
      this.prisma.equipment.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { category: { select: { name: true } }, images: { where: { isPrimary: true }, take: 1 } },
      }),
      this.prisma.job.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { category: { select: { name: true } } },
      }),
      this.prisma.article.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, status: true, viewCount: true, createdAt: true },
      }),
    ]);

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
      recent: { users: recentUsers, equipment: recentEquipment, jobs: recentJobs, articles: recentArticles },
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

    return Promise.all(
      months.map(async ({ year, month }) => {
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        const count = await this.prisma.user.count({
          where: { createdAt: { gte: start, lte: end }, deletedAt: null },
        });
        return { label: start.toLocaleString('default', { month: 'short', year: '2-digit' }), users: count };
      }),
    );
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
