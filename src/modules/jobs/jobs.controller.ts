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

import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('jobs')
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ── Public ────────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List open jobs with filters and pagination' })
  async findAll(@Query() query: JobQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List job categories' })
  async getCategories() {
    return this.jobsService.getCategories();
  }

  // ── Admin ─────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all jobs across all statuses' })
  async adminFindAll(@Query() query: JobQueryDto) {
    return this.jobsService.adminFindAll(query);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get job by ID for editing' })
  async findById(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get single job by slug' })
  async findOne(@Param('slug') slug: string) {
    return this.jobsService.findOne(slug);
  }

  @Public()
  @Post(':id/apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit job application' })
  async submitApplication(
    @Param('id') jobId: string,
    @Body() dto: SubmitApplicationDto,
  ) {
    return this.jobsService.submitApplication(jobId, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a new job posting' })
  async create(
    @Body() dto: CreateJobDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.jobsService.create(dto, adminId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update a job posting' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.jobsService.update(id, dto, adminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Soft-delete a job posting' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.jobsService.remove(id, adminId);
  }
}
