import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitEquipmentInquiryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentLocation: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  farmSize?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  usageDuration?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  additionalDetails?: string;
}
