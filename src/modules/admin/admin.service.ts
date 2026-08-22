import * as argon2 from 'argon2';
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

  async seedProduction() {
    const superAdminPass = await argon2.hash('Admin@Hagrosphere1!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.upsert({
      where: { email: 'admin@hagrosphere.com' },
      update: {},
      create: {
        email: 'admin@hagrosphere.com',
        password: superAdminPass,
        firstName: 'Hagrosphere',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    });

    const equipmentCategories = [
      { name: 'Tractors', slug: 'tractors', description: 'All types of tractors for farm work' },
      { name: 'Harvesters', slug: 'harvesters', description: 'Combine harvesters and reapers' },
      { name: 'Irrigation Systems', slug: 'irrigation-systems', description: 'Drip, sprinkler, and flood irrigation' },
      { name: 'Planting Equipment', slug: 'planting-equipment', description: 'Seeders and planters' },
      { name: 'Storage & Processing', slug: 'storage-processing', description: 'Silos, dryers, and processing machines' },
      { name: 'Transport', slug: 'transport', description: 'Farm trucks and trailers' },
      { name: 'Hand Tools', slug: 'hand-tools', description: 'Manual and power hand tools' },
      { name: 'Drones', slug: 'drones', description: 'Agricultural drones for spraying and surveillance' },
    ];
    for (const cat of equipmentCategories) {
      await this.prisma.equipmentCategory.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
    }

    const jobCategories = [
      { name: 'Farm Management', slug: 'farm-management' },
      { name: 'Agronomy', slug: 'agronomy' },
      { name: 'Agricultural Engineering', slug: 'agricultural-engineering' },
      { name: 'Supply Chain & Logistics', slug: 'supply-chain' },
      { name: 'Sales & Marketing', slug: 'sales-marketing' },
      { name: 'Finance & Accounting', slug: 'finance-accounting' },
      { name: 'Research & Development', slug: 'research-development' },
      { name: 'Technology & IT', slug: 'technology-it' },
    ];
    for (const cat of jobCategories) {
      await this.prisma.jobCategory.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
    }

    const tags = [
      { name: 'Farming Tips', slug: 'farming-tips' },
      { name: 'Technology', slug: 'technology' },
      { name: 'Investment', slug: 'investment' },
      { name: 'Market Trends', slug: 'market-trends' },
      { name: 'Sustainability', slug: 'sustainability' },
      { name: 'Diaspora', slug: 'diaspora' },
      { name: 'Policy', slug: 'policy' },
      { name: 'Success Stories', slug: 'success-stories' },
    ];
    for (const tag of tags) {
      await this.prisma.articleTag.upsert({ where: { slug: tag.slug }, update: {}, create: tag });
    }

    const settings = [
      { key: 'site_name', value: 'Hagrosphere', type: 'string', group: 'general' },
      { key: 'site_tagline', value: "Connecting Africa's Agricultural Ecosystem", type: 'string', group: 'general' },
      { key: 'contact_email', value: 'contact@hagrosphere.com', type: 'string', group: 'general' },
      { key: 'contact_phone', value: '+234 800 000 0000', type: 'string', group: 'general' },
      { key: 'maintenance_mode', value: 'false', type: 'boolean', group: 'general' },
      { key: 'social_twitter', value: 'https://twitter.com/hagrosphere', type: 'string', group: 'social' },
      { key: 'social_linkedin', value: 'https://linkedin.com/company/hagrosphere', type: 'string', group: 'social' },
      { key: 'social_instagram', value: 'https://instagram.com/hagrosphere', type: 'string', group: 'social' },
    ];
    for (const setting of settings) {
      await this.prisma.siteSetting.upsert({ where: { key: setting.key }, update: {}, create: setting });
    }

    return { success: true, message: '🎉 Database seeded successfully', admin: 'admin@hagrosphere.com' };
  }

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
