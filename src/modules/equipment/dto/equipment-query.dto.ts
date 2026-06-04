import { IsOptional, IsString, IsEnum, IsNumber, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus, EquipmentCondition } from '@prisma/client';

export class EquipmentQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit?: number = 12;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: EquipmentStatus }) @IsOptional() @IsEnum(EquipmentStatus) status?: EquipmentStatus;
  @ApiPropertyOptional({ enum: EquipmentCondition }) @IsOptional() @IsEnum(EquipmentCondition) condition?: EquipmentCondition;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) minPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) maxPrice?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() featured?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() sortBy?: string = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: 'asc' | 'desc' = 'desc';
}
