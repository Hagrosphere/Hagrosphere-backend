import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../shared/email.service';
import { buildPaginationMeta } from '../../shared/utils/pagination.util';
import * as xss from 'xss';

export class CreateContactDto {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateContactDto, ipAddress?: string, userId?: string) {
    // Sanitize all text inputs against XSS
    const message = await this.prisma.contactMessage.create({
      data: {
        name: xss.filterXSS(dto.name),
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone,
        subject: xss.filterXSS(dto.subject),
        message: xss.filterXSS(dto.message),
        ipAddress,
        userId,
      },
    });

    // Non-blocking: send confirmation to user + notify admin
    Promise.all([
      this.emailService.sendContactConfirmation(dto.email, dto.name, dto.subject),
      this.emailService.sendAdminContactNotification(dto.name, dto.email, dto.subject),
    ]).catch(() => {});

    return {
      message: "Thank you for your message. We'll get back to you within 24-48 hours.",
    };
  }

  async findAll(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const { page = 1, limit = 20, status, search } = query;

    const where: any = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const skip = (page - 1) * limit;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async markRead(id: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { status: 'READ' },
    });
  }

  async markReplied(id: string, note?: string) {
    return this.prisma.contactMessage.update({
      where: { id },
      data: { status: 'REPLIED', repliedAt: new Date(), replyNote: note },
    });
  }
}
