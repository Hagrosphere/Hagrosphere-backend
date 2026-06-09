import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, ApplicationStatus } from '@prisma/client';
import slugify from 'slugify';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../shared/audit.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { buildPaginationMeta } from '../../shared/utils/pagination.util';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: JobQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      type,
      status = 'OPEN',
      location,
      isRemote,
      featured,
      sortBy = 'publishedAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.JobWhereInput = {
      deletedAt: null, // Exclude soft-deleted jobs
      status,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category: { slug: category } }),
      ...(type && { type }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(isRemote !== undefined && { isRemote }),
      ...(featured !== undefined && { isFeatured: featured }),
      deadline: { gte: new Date() },
    };

    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(slug: string) {
    const job = await this.prisma.job.findFirst({
      where: { slug, deletedAt: null },
      include: { category: true },
    });

    if (!job) throw new NotFoundException('Job not found');

    this.prisma.job
      .update({ where: { id: job.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return job;
  }

  async findById(id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, deletedAt: null },
      include: { category: true },
    });

    if (!job) throw new NotFoundException('Job not found');

    return job;
  }

  async create(dto: CreateJobDto, adminId: string) {
    const slug = await this.generateUniqueSlug(dto.title);

    const job = await this.prisma.job.create({
      data: {
        ...dto,
        slug,
        skills: dto.skills ?? [],
        benefits: dto.benefits ?? [],
        status: dto.status ?? 'DRAFT',
        publishedAt: dto.status === 'OPEN' ? new Date() : null,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include: { category: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'CREATE',
      resourceType: 'job',
      resourceId: job.id,
      description: `Created job: ${job.title}`,
    });

    return job;
  }

  async update(id: string, dto: UpdateJobDto, adminId: string) {
    await this.ensureExists(id);

    const updated = await this.prisma.job.update({
      where: { id },
      data: {
        ...dto,
        // Auto-set publishedAt when opening a job
        ...(dto.status === 'OPEN' && { publishedAt: new Date() }),
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include: { category: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE',
      resourceType: 'job',
      resourceId: id,
      description: `Updated job: ${updated.title}`,
    });

    return updated;
  }

  async remove(id: string, adminId: string) {
    await this.ensureExists(id);

    await this.prisma.job.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DELETE',
      resourceType: 'job',
      resourceId: id,
      description: `Deleted job id: ${id}`,
    });

    return { message: 'Job deleted successfully' };
  }

  async getCategories() {
    return this.prisma.jobCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { jobs: true } } },
    });
  }

  // Admin: get all jobs regardless of status
  async adminFindAll(query: JobQueryDto) {
    const { page = 1, limit = 10, search, status } = query;

    const where: Prisma.JobWhereInput = {
      deletedAt: null, // Exclude soft-deleted jobs from admin list too
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(status && { status }),
    };

    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async submitApplication(jobId: string, dto: SubmitApplicationDto) {
    // Check if job exists and is open
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, deletedAt: null, status: 'OPEN' },
    });

    if (!job) {
      throw new NotFoundException('Job not found or no longer accepting applications');
    }

    // Check if deadline has passed
    if (job.deadline && new Date(job.deadline) < new Date()) {
      throw new BadRequestException('Application deadline has passed');
    }

    // Check if external application URL is used
    if (job.applicationUrl) {
      throw new BadRequestException('This job uses external application process');
    }

    // Create application
    const application = await this.prisma.jobApplication.create({
      data: {
        jobId,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        currentLocation: dto.currentLocation,
        yearsExperience: dto.yearsExperience,
        availability: dto.availability,
        coverLetter: dto.coverLetter,
      },
    });

    return {
      message: 'Application submitted successfully',
      applicationId: application.id,
    };
  }

  private async ensureExists(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job || job.deletedAt) throw new NotFoundException('Job not found');
    return job;
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 1;
    while (await this.prisma.job.findFirst({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  // ── Job Applications ──────────────────────────────────────────────────────

  async getApplications(query: { page?: number; limit?: number; status?: ApplicationStatus; jobId?: string }) {
    const { page = 1, limit = 20, status, jobId } = query;

    const where: Prisma.JobApplicationWhereInput = {
      ...(status && { status }),
      ...(jobId && { jobId }),
    };

    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.jobApplication.count({ where }),
      this.prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            select: { id: true, title: true, company: true, slug: true },
          },
        },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async getApplicationById(id: string) {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        job: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }

  async updateApplicationStatus(id: string, status: ApplicationStatus) {
    const application = await this.prisma.jobApplication.update({
      where: { id },
      data: { status },
    });

    return application;
  }
}
