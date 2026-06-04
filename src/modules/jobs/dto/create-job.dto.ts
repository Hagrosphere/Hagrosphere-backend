import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsNumber,
  IsUrl,
  IsEmail,
  IsDateString,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { JobType, JobStatus } from '@prisma/client';

export class CreateJobDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  company: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  companyLogo?: string;

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
  @IsBoolean()
  isRemote?: boolean;

  @ApiPropertyOptional({ enum: JobType })
  @IsOptional()
  @IsEnum(JobType)
  type?: JobType;

  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsibilities?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSalaryVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  applicationUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  applicationEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class JobQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) limit?: number = 10;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional({ enum: JobType }) @IsOptional() @IsEnum(JobType) type?: JobType;
  @ApiPropertyOptional({ enum: JobStatus }) @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() location?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() isRemote?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() featured?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() sortBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
}
