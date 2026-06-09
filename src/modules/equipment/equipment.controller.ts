import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';
import { SubmitEquipmentInquiryDto } from './dto/submit-equipment-inquiry.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('equipment')
@Controller({ path: 'equipment', version: '1' })
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // ── Public ────────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List equipment with filters, search, and pagination' })
  async findAll(@Query() query: EquipmentQueryDto) {
    return this.equipmentService.findAll(query);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List equipment categories' })
  async getCategories() {
    return this.equipmentService.getCategories();
  }

  // ── Equipment Inquiries ─────────────────────────────────────

  @Public()
  @Post(':id/inquire')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit equipment inquiry' })
  async submitInquiry(
    @Param('id') equipmentId: string,
    @Body() dto: SubmitEquipmentInquiryDto,
  ) {
    return this.equipmentService.submitInquiry(equipmentId, dto);
  }

  @Get('admin/inquiries/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all equipment inquiries' })
  async getInquiries(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('equipmentId') equipmentId?: string,
  ) {
    const validStatus = status ? this.validateStatus(status) : undefined;
    return this.equipmentService.getInquiries({ page, limit, status: validStatus, equipmentId });
  }

  @Get('admin/inquiries/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get inquiry by ID' })
  async getInquiryById(@Param('id') id: string) {
    return this.equipmentService.getInquiryById(id);
  }

  @Patch('admin/inquiries/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update inquiry status' })
  async updateInquiryStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const validStatus = this.validateStatus(status);
    return this.equipmentService.updateInquiryStatus(id, validStatus);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get single equipment by slug' })
  async findOne(@Param('slug') slug: string) {
    return this.equipmentService.findOne(slug);
  }

  // ── Admin ─────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new equipment listing' })
  async create(
    @Body() dto: CreateEquipmentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.equipmentService.create(dto, adminId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update equipment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.equipmentService.update(id, dto, adminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: Soft-delete equipment' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.equipmentService.remove(id, adminId);
  }

  private validateStatus(status: string): ApplicationStatus {
    const validStatuses: ApplicationStatus[] = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'ACCEPTED'];
    if (!validStatuses.includes(status as ApplicationStatus)) {
      throw new BadRequestException('Invalid status');
    }
    return status as ApplicationStatus;
  }
}
