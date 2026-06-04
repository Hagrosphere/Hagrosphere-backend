import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../shared/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Site Settings ─────────────────────────────────────────

  async getSettings(group?: string) {
    const settings = await this.prisma.siteSetting.findMany({
      where: group ? { group } : undefined,
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });

    // Return as a key-value map grouped by group
    return settings.reduce(
      (acc, s) => {
        const g = s.group ?? 'general';
        if (!acc[g]) acc[g] = {};
        acc[g][s.key] = this.parseSettingValue(s.value, s.type);
        return acc;
      },
      {} as Record<string, Record<string, any>>,
    );
  }

  async updateSetting(key: string, value: string, adminId: string) {
    const existing = await this.prisma.siteSetting.findUnique({ where: { key } });

    if (!existing) throw new NotFoundException(`Setting "${key}" not found`);

    const updated = await this.prisma.siteSetting.update({
      where: { key },
      data: { value: String(value) },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE',
      resourceType: 'setting',
      resourceId: key,
      description: `Updated setting: ${key}`,
    });

    return updated;
  }

  async bulkUpdateSettings(
    updates: Record<string, string>,
    adminId: string,
  ) {
    const results = await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        this.updateSetting(key, value, adminId),
      ),
    );

    return { updated: results.length, settings: results };
  }

  // ── Newsletter Subscribers ────────────────────────────────

  async getSubscribers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.count(),
      this.prisma.newsletterSubscriber.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async subscribe(email: string) {
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      if (!existing.isActive) {
        await this.prisma.newsletterSubscriber.update({
          where: { email: email.toLowerCase() },
          data: { isActive: true },
        });
        return { message: 'You have been re-subscribed to our newsletter.' };
      }
      return { message: 'You are already subscribed to our newsletter.' };
    }

    await this.prisma.newsletterSubscriber.create({
      data: { email: email.toLowerCase(), confirmedAt: new Date() },
    });

    return { message: 'Successfully subscribed to our newsletter!' };
  }

  async unsubscribe(email: string) {
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email: email.toLowerCase() },
      data: { isActive: false },
    });
    return { message: 'You have been unsubscribed.' };
  }

  // ── Health check ──────────────────────────────────────────

  async getHealth() {
    const dbHealthy = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
        api: 'up',
      },
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  private parseSettingValue(value: string, type: string): any {
    try {
      if (type === 'json') return JSON.parse(value);
      if (type === 'boolean') return value === 'true';
      if (type === 'number') return Number(value);
      return value;
    } catch {
      return value;
    }
  }
}
