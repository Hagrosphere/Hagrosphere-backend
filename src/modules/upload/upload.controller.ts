import {
  Controller,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';

import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('upload')
@Controller({ path: 'upload', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Single image upload — used for article cover images,
   * equipment primary image, job company logos
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a single image to Cloudinary' })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'general',
    @CurrentUser('id') adminId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadImage(file, folder, adminId);
  }

  /**
   * Multiple images upload — used for equipment gallery
   */
  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload multiple images (max 10) to Cloudinary' })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder = 'general',
    @CurrentUser('id') adminId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return this.uploadService.uploadMultipleImages(files, folder, adminId);
  }

  /**
   * Delete an uploaded file from Cloudinary
   */
  @Delete(':publicId')
  @ApiOperation({ summary: 'Delete an uploaded file by Cloudinary public ID' })
  async deleteFile(@Param('publicId') publicId: string) {
    await this.uploadService.deleteFile(publicId);
    return { message: 'File deleted successfully' };
  }
}
