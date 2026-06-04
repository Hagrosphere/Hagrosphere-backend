import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class UpdateRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class UpdateStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: List all users with filters' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.findAll({ page, limit, search, role, status });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Admin: Get user statistics' })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: Get a single user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/role')
  @Roles('SUPER_ADMIN') // Only super admins can change roles
  @ApiOperation({ summary: 'Super Admin: Update user role' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.updateRole(id, dto.role, adminId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Admin: Suspend or activate a user' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.updateStatus(id, dto.status, adminId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin: Soft-delete a user account' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.softDelete(id, adminId);
  }
}
