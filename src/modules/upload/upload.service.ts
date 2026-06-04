import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../../database/prisma.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf'];
const MAX_IMAGE_SIZE_MB = 5;
const MAX_DOC_SIZE_MB = 10;

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
  size: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    cloudinary.config({
      cloud_name: configService.get<string>('cloudinary.cloudName'),
      api_key: configService.get<string>('cloudinary.apiKey'),
      api_secret: configService.get<string>('cloudinary.apiSecret'),
      secure: true,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    uploadedById?: string,
  ): Promise<UploadResult> {
    this.validateFile(file, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE_MB);

    const result = await this.uploadToCloudinary(file.buffer, {
      folder: `${this.configService.get('cloudinary.folder')}/${folder}`,
      resource_type: 'image',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1200, height: 900, crop: 'limit' },
      ],
    });

    await this.logUpload(file, result.secure_url, result.public_id, uploadedById);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.bytes,
    };
  }

  async uploadMultipleImages(
    files: Express.Multer.File[],
    folder: string,
    uploadedById?: string,
  ): Promise<UploadResult[]> {
    return Promise.all(files.map((f) => this.uploadImage(f, folder, uploadedById)));
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  private validateFile(
    file: Express.Multer.File,
    allowedTypes: string[],
    maxSizeMb: number,
  ) {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Maximum size: ${maxSizeMb}MB`,
      );
    }
  }

  private uploadToCloudinary(
    buffer: Buffer,
    options: Record<string, any>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      stream.end(buffer);
    });
  }

  private async logUpload(
    file: Express.Multer.File,
    url: string,
    publicId: string,
    uploadedById?: string,
  ) {
    await this.prisma.fileUpload.create({
      data: {
        filename: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        publicId,
        uploadedById,
      },
    });
  }
}
