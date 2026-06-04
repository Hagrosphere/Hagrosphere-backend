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

import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleQueryDto } from './dto/article-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('articles')
@Controller({ path: 'articles', version: '1' })
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // ── Public ────────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published articles with filters and pagination' })
  async findAll(@Query() query: ArticleQueryDto) {
    return this.articlesService.findPublished(query);
  }

  @Public()
  @Get('tags')
  @ApiOperation({ summary: 'List all article tags' })
  async getTags() {
    return this.articlesService.getTags();
  }

  // ── Admin ─────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all articles across all statuses' })
  async adminFindAll(@Query() query: ArticleQueryDto) {
    return this.articlesService.adminFindAll(query);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get article by ID for editing' })
  async findById(@Param('id') id: string) {
    return this.articlesService.findById(id);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a single published article by slug' })
  async findOne(@Param('slug') slug: string) {
    return this.articlesService.findOnePublished(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create a new article' })
  async create(
    @Body() dto: CreateArticleDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.articlesService.create(dto, adminId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update an article' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.articlesService.update(id, dto, adminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Soft-delete an article' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.articlesService.remove(id, adminId);
  }
}
