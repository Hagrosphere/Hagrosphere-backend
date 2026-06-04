import { IsString, IsEmail, IsInt, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitApplicationDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Lagos, Nigeria' })
  @IsString()
  @IsNotEmpty()
  currentLocation: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  yearsExperience: number;

  @ApiProperty({ example: 'Immediately' })
  @IsString()
  @IsNotEmpty()
  availability: string;

  @ApiProperty({ example: 'I am interested in this position...' })
  @IsString()
  @IsNotEmpty()
  coverLetter: string;
}
