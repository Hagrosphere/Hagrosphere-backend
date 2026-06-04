import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../shared/audit.service';
import { buildPaginationMeta } from '../../shared/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    status?: UserStatus;
  }) {
    const { page = 1, limit = 20, search, role, status } = query;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(role && { role }),
      ...(status && { status }),
    };

    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          avatar: true,
        },
      }),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isEmailVerified: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        avatar: true,
        phone: true,
      },
    });

    if (!user || (user as any).deletedAt) throw new NotFoundException('User not found');
    return user;
  }

  async updateRole(id: string, role: UserRole, adminId: string) {
    if (id === adminId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const user = await this.findOne(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'UPDATE',
      resourceType: 'user',
      resourceId: id,
      description: `Changed role of ${user.email} from ${user.role} to ${role}`,
    });

    return updated;
  }

  async updateStatus(id: string, status: UserStatus, adminId: string) {
    if (id === adminId) {
      throw new BadRequestException('You cannot change your own account status');
    }

    const user = await this.findOne(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, status: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: status === 'SUSPENDED' ? 'SUSPEND' : 'ACTIVATE',
      resourceType: 'user',
      resourceId: id,
      description: `Changed status of ${user.email} to ${status}`,
    });

    return updated;
  }

  async softDelete(id: string, adminId: string) {
    if (id === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.findOne(id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'INACTIVE' },
      }),
      // Revoke all tokens
      this.prisma.refreshToken.updateMany({
        where: { userId: id },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId: adminId,
      action: 'DELETE',
      resourceType: 'user',
      resourceId: id,
      description: `Admin deleted user id: ${id}`,
    });

    return { message: 'User deleted' };
  }

  async getStats() {
    const [total, active, suspended, admins, thisMonth] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED', deletedAt: null } }),
      this.prisma.user.count({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          deletedAt: null,
        },
      }),
    ]);

    return { total, active, suspended, admins, thisMonth };
  }
}
