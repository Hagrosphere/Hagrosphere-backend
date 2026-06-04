import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../shared/audit.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { buildPaginationMeta } from '../../shared/utils/pagination.util';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findPublished(query: ArticleQueryDto) {
    const { page = 1, limit = 9, search, category, tag, featured, sortBy = 'publishedAt', sortOrder = 'desc' } = query;

    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category: category as any }),
      ...(tag && { tags: { some: { slug: tag } } }),
      ...(featured !== undefined && { isFeatured: featured }),
    };

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { tags: true },
      }),
    ]);

    return {
      data: data.map(({ content: _c, ...rest }) => rest),
      meta: buildPaginationMeta(total, page, limit),
    };
  }

  async findOnePublished(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { tags: true },
    });

    if (!article) throw new NotFoundException('Article not found');

    this.prisma.article
      .update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    const related = await this.prisma.article.findMany({
      where: {
        category: article.category,
        status: 'PUBLISHED',
        id: { not: article.id },
      },
      take: 3,
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true },
    });

    return { ...article, related };
  }

  async findById(id: string) {
    const article = await this.prisma.article.findFirst({
      where: { id, deletedAt: null },
      include: { tags: true },
    });

    if (!article) throw new NotFoundException('Article not found');

    return article;
  }

  async adminFindAll(query: ArticleQueryDto) {
    const { page = 1, limit = 10, search, category, status } = query;

    const where: Prisma.ArticleWhereInput = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category: category as any }),
      ...(status && { status: status as any }),
    };

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { tags: true },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async create(dto: CreateArticleDto, adminId: string) {
    const slug = await this.generateUniqueSlug(dto.title);
    const readTime = this.calculateReadTime(dto.content);

    const article = await this.prisma.article.create({
      data: {
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImage: dto.coverImage,
        coverImageId: dto.coverImageId,
        category: dto.category ?? 'GENERAL',
        status: dto.status ?? 'DRAFT',
        isFeatured: dto.isFeatured ?? false,
        author: dto.author ?? 'Hagrosphere Team',
        readTime,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
        tags: dto.tagIds
          ? { connect: dto.tagIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { tags: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'CREATE',
      resourceType: 'article',
      resourceId: article.id,
      description: `Created article: ${article.title}`,
    });

    return article;
  }

  async update(id: string, dto: UpdateArticleDto, adminId: string) {
    await this.ensureExists(id);

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.title && {
          title: dto.title,
          slug: await this.generateUniqueSlug(dto.title, id),
        }),
        ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
        ...(dto.content && {
          content: dto.content,
          readTime: this.calculateReadTime(dto.content),
        }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.category && { category: dto.category }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.author && { author: dto.author }),
        ...(dto.status && {
          status: dto.status,
          publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
        }),
        ...(dto.tagIds && {
          tags: { set: dto.tagIds.map((id) => ({ id })) },
        }),
      },
      include: { tags: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE',
      resourceType: 'article',
      resourceId: id,
      description: `Updated article: ${updated.title}`,
    });

    return updated;
  }

  async remove(id: string, adminId: string) {
    await this.ensureExists(id);
    await this.prisma.article.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.auditService.log({
      userId: adminId,
      action: 'DELETE',
      resourceType: 'article',
      resourceId: id,
      description: `Deleted article id: ${id}`,
    });

    return { message: 'Article deleted' };
  }

  async getTags() {
    return this.prisma.articleTag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
  }

  private async ensureExists(id: string) {
    const a = await this.prisma.article.findUnique({ where: { id } });
    if (!a || a.deletedAt) throw new NotFoundException('Article not found');
    return a;
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let counter = 1;
    while (
      await this.prisma.article.findFirst({
        where: { slug, ...(excludeId && { id: { not: excludeId } }) },
      })
    ) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }
}
