import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '@prisma/client';

interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: params });
    } catch (err) {
      // Audit logging failure must never break main flow
      this.logger.error('Failed to write audit log', err);
    }
  }
}
