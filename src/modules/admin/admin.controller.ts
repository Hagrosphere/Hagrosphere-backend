import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsObject } from 'class-validator';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import * as argon2 from 'argon2';

class UpdateSettingDto {
  @IsString() @IsNotEmpty() value: string;
}
class BulkUpdateSettingsDto {
  @IsObject() settings: Record<string, string>;
}
class SubscribeDto {
  @IsEmail() email: string;
}

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('health')
  async getHealth() {
    return this.adminService.getHealth();
  }

  @Public()
  @Post('newsletter/subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(@Body() dto: SubscribeDto) {
    return this.adminService.subscribe(dto.email);
  }

  @Public()
  @Post('newsletter/unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Body() dto: SubscribeDto) {
    return this.adminService.unsubscribe(dto.email);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async getSettings(@Query('group') group?: string) {
    return this.adminService.getSettings(group);
  }

  @Patch('settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateSetting(key, dto.value, adminId);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async bulkUpdateSettings(
    @Body() dto: BulkUpdateSettingsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.bulkUpdateSettings(dto.settings, adminId);
  }

  @Get('newsletter/subscribers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async getSubscribers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getSubscribers(+page, +limit);
  }

  // ── TEMPORARY SEED ENDPOINT — remove after first use ─────────
  @Public()
  @Post('seed-production')
  @HttpCode(HttpStatus.OK)
  async seedProduction() {
    const hashedPassword = await argon2.hash('Admin@Hagrosphere1!', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const admin = await this.prisma.user.upsert({
      where: { email: 'admin@hagrosphere.com' },
      update: {},
      create: {
        email: 'admin@hagrosphere.com',
        password: hashedPassword,
        firstName: 'Hagrosphere',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        isEmailVerified: true,
      },
    });

    const equipmentCategories = [
      { name: 'Tractors', slug: 'tractors' },
      { name: 'Harvesters', slug: 'harvesters' },
      { name: 'Irrigation Systems', slug: 'irrigation-systems' },
      { name: 'Planting Equipment', slug: 'planting-equipment' },
      { name: 'Storage & Processing', slug: 'storage-processing' },
      { name: 'Transport', slug: 'transport' },
      { name: 'Hand Tools', slug: 'hand-tools' },
      { name: 'Drones', slug: 'drones' },
    ];

    for (const cat of equipmentCategories) {
      await this.prisma.equipmentCategory.upsert({
        where: { slug: cat.slug },
        update: {},
        create: { ...cat, description: null },
      });
    }

    const jobCategories = [
      { name: 'Farm Management', slug: 'farm-management' },
      { name: 'Agronomy', slug: 'agronomy' },
      { name: 'Agricultural Engineering', slug: 'agricultural-engineering' },
      { name: 'Supply Chain & Logistics', slug: 'supply-chain' },
      { name: 'Sales & Marketing', slug: 'sales-marketing' },
      { name: 'Technology & IT', slug: 'technology-it' },
    ];

    for (const cat of jobCategories) {
      await this.prisma.jobCategory.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }

    const tags = [
      { name: 'Farming Tips', slug: 'farming-tips' },
      { name: 'Technology', slug: 'technology' },
      { name: 'Investment', slug: 'investment' },
      { name: 'Market Trends', slug: 'market-trends' },
      { name: 'Sustainability', slug: 'sustainability' },
      { name: 'Diaspora', slug: 'diaspora' },
    ];

    for (const tag of tags) {
      await this.prisma.articleTag.upsert({
        where: { slug: tag.slug },
        update: {},
        create: tag,
      });
    }

    const settings = [
      { key: 'site_name', value: 'Hagrosphere', type: 'string', group: 'general' },
      { key: 'contact_email', value: 'contact@hagrosphere.com', type: 'string', group: 'general' },
    ];

    for (const setting of settings) {
      await this.prisma.siteSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }

    return {
      message: '✅ Production database seeded successfully',
      admin: admin.email,
      note: 'IMPORTANT: Remove the seed-production endpoint from admin.controller.ts and redeploy',
    };
  }
}
