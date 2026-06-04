import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsObject } from 'class-validator';

import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}

class BulkUpdateSettingsDto {
  @IsObject()
  settings: Record<string, string>;
}

class SubscribeDto {
  @IsEmail()
  email: string;
}

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Health (public) ───────────────────────────────────────

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'API and service health check' })
  async getHealth() {
    return this.adminService.getHealth();
  }

  // ── Newsletter (public subscribe) ─────────────────────────

  @Public()
  @Post('newsletter/subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe to the Hagrosphere newsletter' })
  async subscribe(@Body() dto: SubscribeDto) {
    return this.adminService.subscribe(dto.email);
  }

  @Public()
  @Post('newsletter/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unsubscribe from the newsletter' })
  async unsubscribe(@Body() dto: SubscribeDto) {
    return this.adminService.unsubscribe(dto.email);
  }

  // ── Admin: Settings ───────────────────────────────────────

  @Get('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all site settings grouped by category' })
  async getSettings(@Query('group') group?: string) {
    return this.adminService.getSettings(group);
  }

  @Patch('settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin: Update a single site setting' })
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
  @ApiOperation({ summary: 'Super Admin: Bulk update site settings' })
  async bulkUpdateSettings(
    @Body() dto: BulkUpdateSettingsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.bulkUpdateSettings(dto.settings, adminId);
  }

  // ── Admin: Newsletter Subscribers ─────────────────────────

  @Get('newsletter/subscribers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List newsletter subscribers' })
  async getSubscribers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getSubscribers(+page, +limit);
  }
}
