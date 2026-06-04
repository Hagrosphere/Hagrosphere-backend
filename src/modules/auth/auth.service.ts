import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import { PrismaService } from '../../database/prisma.service';
import { TokenService } from './token.service';
import { EmailService } from '../shared/email.service';
import { AuditService } from '../shared/audit.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFY_EXPIRES_HOURS = 24;
const PASSWORD_RESET_EXPIRES_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  // ── Registration ──────────────────────────────────────────

  async register(dto: RegisterDto, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpires = new Date(
      Date.now() + EMAIL_VERIFY_EXPIRES_HOURS * 3600 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailVerifyToken,
        emailVerifyExpires,
        status: 'PENDING_VERIFICATION',
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    // Send verification email (non-blocking)
    this.emailService
      .sendEmailVerification(user.email, user.firstName, emailVerifyToken)
      .catch((err) => this.logger.error('Failed to send verification email', err));

    await this.auditService.log({
      action: 'CREATE',
      resourceType: 'user',
      resourceId: user.id,
      description: `New user registered: ${user.email}`,
      ipAddress,
    });

    return { message: 'Registration successful. Please verify your email.' };
  }

  // ── Email Verification ────────────────────────────────────

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
        isEmailVerified: false,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        status: 'ACTIVE',
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  // ── Login ─────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Brute-force lockout check
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      );
    }

    const isPasswordValid = await argon2.verify(user.password, dto.password);

    if (!isPasswordValid) {
      const newAttempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: newAttempts };

      if (newAttempts >= LOCKOUT_ATTEMPTS) {
        updateData.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        updateData.loginAttempts = 0;
      }

      await this.prisma.user.update({ where: { id: user.id }, data: updateData });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException('Your account has been suspended. Contact support.');
    }

    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('Your account is inactive.');
    }

    // Reset failed attempts on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    const tokens = await this.tokenService.generateTokenPair(
      user.id,
      user.role,
      ipAddress,
      userAgent,
    );

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      resourceType: 'user',
      resourceId: user.id,
      description: `User logged in`,
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
      },
      ...tokens,
    };
  }

  // ── Admin Login (stricter) ────────────────────────────────

  async adminLogin(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const result = await this.login(dto, ipAddress, userAgent);

    if (!['ADMIN', 'SUPER_ADMIN'].includes(result.user.role)) {
      // Revoke the tokens we just issued — not an admin
      await this.tokenService.revokeAllUserTokens(result.user.id);
      throw new ForbiddenException('Access denied. Admin privileges required.');
    }

    return result;
  }

  // ── Refresh Token ─────────────────────────────────────────

  async refreshTokens(refreshToken: string, ipAddress?: string) {
    return this.tokenService.rotateRefreshToken(refreshToken, ipAddress);
  }

  // ── Logout ────────────────────────────────────────────────

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      resourceType: 'user',
      resourceId: userId,
      description: 'User logged out',
    });

    return { message: 'Logged out successfully' };
  }

  // ── Forgot Password ───────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    // Always return 200 to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + PASSWORD_RESET_EXPIRES_HOURS * 3600 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpires: expires },
    });

    this.emailService
      .sendPasswordReset(user.email, user.firstName, resetToken)
      .catch((err) => this.logger.error('Failed to send password reset email', err));

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // ── Reset Password ────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
          loginAttempts: 0,
          lockoutUntil: null,
        },
      }),
      // Revoke ALL refresh tokens — force re-login everywhere
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET',
      resourceType: 'user',
      resourceId: user.id,
      description: 'Password reset successfully',
    });

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ── Get Current User ──────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        avatar: true,
        phone: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
