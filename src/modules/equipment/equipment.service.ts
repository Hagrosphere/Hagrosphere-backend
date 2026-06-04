import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../shared/audit.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentQueryDto } from './dto/equipment-query.dto';
import { buildPaginationMeta, PaginationMeta } from '../../shared/utils/pagination.util';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Public: List with filters ─────────────────────────────

  async findAll(query: EquipmentQueryDto): Promise<{ data: any[]; meta: PaginationMeta }> {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      status,
      condition,
      location,
      minPrice,
      maxPrice,
      featured,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.EquipmentWhereInput = {
      deletedAt: null, // Exclude soft-deleted items
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category: { slug: category } }),
      ...(status && { status }),
      ...(condition && { condition }),
      ...(location && { location: { contains: location, mode: 'insensitive' } }),
      ...(minPrice !== undefined && { pricePerDay: { gte: minPrice } }),
      ...(maxPrice !== undefined && { pricePerDay: { lte: maxPrice } }),
      ...(featured !== undefined && { isFeatured: featured }),
    };

    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.equipment.count({ where }),
      this.prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, altText: true },
          },
        },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  // ── Public: Single item ───────────────────────────────────

  async findOne(slug: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { slug, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });

    if (!equipment) throw new NotFoundException('Equipment not found');

    // Increment view count (fire-and-forget)
    this.prisma.equipment
      .update({ where: { id: equipment.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    return equipment;
  }

  // ── Admin: Create ─────────────────────────────────────────

  async create(dto: CreateEquipmentDto, adminId: string) {
    const slug = await this.generateUniqueSlug(dto.name);

    const equipment = await this.prisma.equipment.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        pricePerDay: dto.pricePerDay,
        pricePerWeek: dto.pricePerWeek,
        pricePerMonth: dto.pricePerMonth,
        currency: dto.currency ?? 'NGN',
        status: dto.status ?? 'AVAILABLE',
        condition: dto.condition ?? 'GOOD',
        location: dto.location,
        state: dto.state,
        brand: dto.brand,
        model: dto.model,
        yearOfMake: dto.yearOfMake,
        specifications: dto.specifications,
        features: dto.features ?? [],
        categoryId: dto.categoryId,
        isFeatured: dto.isFeatured ?? false,
        images: dto.images
          ? {
              create: dto.images.map((img, i) => ({
                url: img.url,
                publicId: img.publicId,
                altText: img.altText,
                isPrimary: i === 0,
                order: i,
              })),
            }
          : undefined,
      },
      include: {
        category: true,
        images: true,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'CREATE',
      resourceType: 'equipment',
      resourceId: equipment.id,
      description: `Created equipment: ${equipment.name}`,
    });

    return equipment;
  }

  // ── Admin: Update ─────────────────────────────────────────

  async update(id: string, dto: UpdateEquipmentDto, adminId: string) {
    await this.ensureExists(id);

    const updated = await this.prisma.equipment.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.pricePerDay !== undefined && { pricePerDay: dto.pricePerDay }),
        ...(dto.pricePerWeek !== undefined && { pricePerWeek: dto.pricePerWeek }),
        ...(dto.pricePerMonth !== undefined && { pricePerMonth: dto.pricePerMonth }),
        ...(dto.status && { status: dto.status }),
        ...(dto.condition && { condition: dto.condition }),
        ...(dto.location && { location: dto.location }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.yearOfMake !== undefined && { yearOfMake: dto.yearOfMake }),
        ...(dto.specifications !== undefined && { specifications: dto.specifications }),
        ...(dto.features !== undefined && { features: dto.features }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
      },
      include: { category: true, images: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE',
      resourceType: 'equipment',
      resourceId: id,
      description: `Updated equipment: ${updated.name}`,
    });

    return updated;
  }

  // ── Admin: Delete (soft) ──────────────────────────────────

  async remove(id: string, adminId: string) {
    await this.ensureExists(id);

    await this.prisma.equipment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DELETE',
      resourceType: 'equipment',
      resourceId: id,
      description: `Deleted equipment id: ${id}`,
    });

    return { message: 'Equipment deleted successfully' };
  }

  // ── Categories ────────────────────────────────────────────

  async getCategories() {
    return this.prisma.equipmentCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { equipment: true } } },
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  private async ensureExists(id: string) {
    const eq = await this.prisma.equipment.findUnique({ where: { id } });
    if (!eq || eq.deletedAt) throw new NotFoundException('Equipment not found');
    return eq;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let counter = 1;

    while (await this.prisma.equipment.findFirst({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }

    return slug;
  }
}
