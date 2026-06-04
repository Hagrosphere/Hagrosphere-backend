import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('dashboard')
@Controller({ path: 'dashboard', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Admin: Get dashboard overview stats and charts' })
  async getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Admin: Get activity feed / audit log' })
  async getActivity(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.dashboardService.getActivityFeed(+page, +limit);
  }
}
