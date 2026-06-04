import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  type: 'access' | 'refresh';
  jti?: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly REFRESH_TOKEN_EXPIRES_DAYS = 7;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(
    userId: string,
    role: UserRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const jti = crypto.randomUUID();

    const accessToken = this.jwtService.sign(
      { sub: userId, role, type: 'access', jti },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, role, type: 'refresh', jti },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    // Store hashed refresh token — never store plain
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async rotateRefreshToken(rawRefreshToken: string, ipAddress?: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(rawRefreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: { user: { select: { id: true, role: true, status: true } } },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      // Possible token reuse — revoke all tokens for this user (security!)
      await this.revokeAllUserTokens(payload.sub);
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (stored.user.status === 'SUSPENDED' || stored.user.status === 'INACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    return this.generateTokenPair(
      stored.userId,
      stored.user.role,
      ipAddress,
      stored.userAgent ?? undefined,
    );
  }

  async revokeRefreshToken(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      // No token to revoke - this is fine
      return;
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    await this.prisma.refreshToken
      .update({
        where: { token: tokenHash },
        data: { isRevoked: true, revokedAt: new Date() },
      })
      .catch(() => {
        // Token might not exist — harmless
      });
  }

  async revokeAllUserTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  // Cleanup expired tokens (called by cron job)
  async purgeExpiredTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 7 * 86400000) } },
        ],
      },
    });

    this.logger.log(`Purged ${result.count} expired/revoked refresh tokens`);
  }
}
