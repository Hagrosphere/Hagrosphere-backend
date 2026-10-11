import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
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
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, role, type: 'refresh', jti },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d') as JwtSignOptions['expiresIn'],
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    // Store hashed refresh token — never store plain
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const newRecord = await this.prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, newTokenId: newRecord.id };
  }

  private readonly GRACE_WINDOW_MS = 20_000; // 20 seconds

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

    if (!stored) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (stored.isRevoked) {
      const revokedMs = stored.revokedAt ? Date.now() - stored.revokedAt.getTime() : Infinity;

      if (revokedMs <= this.GRACE_WINDOW_MS && stored.replacedByTokenId) {
        // Within grace window: likely a duplicate network request after rotation.
        // Look up the exact replacement token recorded at rotation time.
        const replacement = await this.prisma.refreshToken.findUnique({
          where: { id: stored.replacedByTokenId },
          include: { user: { select: { id: true, role: true, status: true } } },
        });
        if (replacement && !replacement.isRevoked && replacement.expiresAt > new Date()) {
          // Rotate the replacement so the client receives a fresh token pair.
          const { accessToken, refreshToken, newTokenId } = await this.generateTokenPair(
            replacement.userId,
            replacement.user.role,
            ipAddress,
            replacement.userAgent ?? undefined,
          );
          await this.prisma.refreshToken.update({
            where: { id: replacement.id },
            data: { isRevoked: true, revokedAt: new Date(), replacedByTokenId: newTokenId },
          });
          return { accessToken, refreshToken };
        }
      }

      // Outside grace window or no valid replacement — genuine reuse detected.
      // Revoke only the forward chain from this token; leave other sessions untouched.
      await this.revokeChain(stored.id);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (stored.user.status === 'SUSPENDED' || stored.user.status === 'INACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Normal rotation: issue a new pair, then mark the old token revoked with a pointer to its replacement.
    const { accessToken, refreshToken, newTokenId } = await this.generateTokenPair(
      stored.userId,
      stored.user.role,
      ipAddress,
      stored.userAgent ?? undefined,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true, revokedAt: new Date(), replacedByTokenId: newTokenId },
    });

    return { accessToken, refreshToken };
  }

  // Follow replacedByTokenId forward from startId and revoke every token in that chain.
  // Stops when a token has no replacement or the chain exceeds 20 hops (safety cap).
  private async revokeChain(startId: string): Promise<void> {
    let currentId: string | null = startId;
    let hops = 0;
    const MAX_HOPS = 20;

    while (currentId && hops < MAX_HOPS) {
      const record: { id: string; isRevoked: boolean; replacedByTokenId: string | null } | null = await this.prisma.refreshToken.findUnique({
        where: { id: currentId },
        select: { id: true, isRevoked: true, replacedByTokenId: true },
      });
      if (!record) break;
      if (!record.isRevoked) {
        await this.prisma.refreshToken.update({
          where: { id: record.id },
          data: { isRevoked: true, revokedAt: new Date() },
        });
      }
      currentId = record.replacedByTokenId;
      hops++;
    }
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
