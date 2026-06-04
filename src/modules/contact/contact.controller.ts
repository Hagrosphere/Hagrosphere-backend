import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class CreateContactDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

class UpdateContactStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  replyNote?: string;
}

@ApiTags('contact')
@Controller({ path: 'contact', version: '1' })
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // ── Public: submit form ───────────────────────────────────

  @Public()
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 3 } }) // 3 submissions/min per IP
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a contact/inquiry form' })
  async create(
    @Body() dto: CreateContactDto,
    @Req() req: Request,
    @CurrentUser('id') userId?: string,
  ) {
    return this.contactService.create(dto, req.ip, userId);
  }

  // ── Admin: manage messages ────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all contact messages' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.contactService.findAll({ page, limit, status, search });
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Mark message as read' })
  async markRead(@Param('id') id: string) {
    return this.contactService.markRead(id);
  }

  @Patch(':id/replied')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Mark message as replied' })
  async markReplied(
    @Param('id') id: string,
    @Body() dto: UpdateContactStatusDto,
  ) {
    return this.contactService.markReplied(id, dto.replyNote);
  }
}
