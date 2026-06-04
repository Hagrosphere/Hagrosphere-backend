import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsObject,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  EquipmentStatus,
  EquipmentCondition,
} from '@prisma/client';

class EquipmentImageDto {
  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateEquipmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  pricePerDay: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerMonth?: number;

  @ApiPropertyOptional({ default: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: EquipmentStatus })
  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @ApiPropertyOptional({ enum: EquipmentCondition })
  @IsOptional()
  @IsEnum(EquipmentCondition)
  condition?: EquipmentCondition;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  yearOfMake?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: [EquipmentImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipmentImageDto)
  images?: EquipmentImageDto[];
}

export class UpdateEquipmentDto extends PartialType(CreateEquipmentDto) {}
