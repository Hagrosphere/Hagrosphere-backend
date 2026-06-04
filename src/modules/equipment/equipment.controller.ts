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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';

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
}
