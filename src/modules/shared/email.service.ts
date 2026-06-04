import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('email.host'),
      port: config.get<number>('email.port', 587),
      secure: config.get<boolean>('email.secure', false),
      auth: {
        user: config.get<string>('email.user'),
        pass: config.get<string>('email.password'),
      },
    });
  }

  async sendEmailVerification(email: string, firstName: string, token: string) {
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    await this.send({
      to: email,
      subject: 'Verify your Hagrosphere account',
      html: this.buildTemplate({
        title: 'Verify your email',
        preheader: 'Click the button below to verify your Hagrosphere account.',
        body: `
          <p>Hello ${firstName},</p>
          <p>Welcome to Hagrosphere! Please verify your email address to activate your account.</p>
          <p>This link expires in 24 hours.</p>
        `,
        ctaText: 'Verify Email',
        ctaUrl: verifyUrl,
      }),
    });
  }

  async sendPasswordReset(email: string, firstName: string, token: string) {
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.send({
      to: email,
      subject: 'Reset your Hagrosphere password',
      html: this.buildTemplate({
        title: 'Password Reset Request',
        preheader: 'You requested a password reset for your Hagrosphere account.',
        body: `
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password. Click the button below to set a new password.</p>
          <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        `,
        ctaText: 'Reset Password',
        ctaUrl: resetUrl,
      }),
    });
  }

  async sendContactConfirmation(email: string, name: string, subject: string) {
    await this.send({
      to: email,
      subject: `We received your message: ${subject}`,
      html: this.buildTemplate({
        title: 'Message Received',
        preheader: 'Thank you for contacting Hagrosphere.',
        body: `
          <p>Hello ${name},</p>
          <p>Thank you for reaching out to us. We have received your message regarding "<strong>${subject}</strong>" and will get back to you within 24–48 business hours.</p>
        `,
        ctaText: 'Visit Hagrosphere',
        ctaUrl: this.config.get<string>('app.frontendUrl') ?? 'https://hagrosphere.com',
      }),
    });
  }

  async sendAdminContactNotification(name: string, email: string, subject: string) {
    const adminEmail = this.config.get<string>('app.adminEmail');
    await this.send({
      to: adminEmail ?? email,
      subject: `[Hagrosphere] New contact message: ${subject}`,
      html: `<p><strong>From:</strong> ${name} (${email})</p><p><strong>Subject:</strong> ${subject}</p>`,
    });
  }

  private async send(options: nodemailer.SendMailOptions) {
    const from = this.config.get<string>('email.from', 'Hagrosphere <no-reply@hagrosphere.com>');
    try {
      await this.transporter.sendMail({ from, ...options });
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
      throw err;
    }
  }

  private buildTemplate(opts: {
    title: string;
    preheader: string;
    body: string;
    ctaText: string;
    ctaUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f4;">${opts.preheader}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#2d6a4f;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">🌿 Hagrosphere</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px;color:#333;font-size:15px;line-height:1.6;">
          <h2 style="color:#2d6a4f;margin-top:0;">${opts.title}</h2>
          ${opts.body}
          <div style="text-align:center;margin:32px 0;">
            <a href="${opts.ctaUrl}" style="background:#2d6a4f;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
              ${opts.ctaText}
            </a>
          </div>
          <p style="font-size:13px;color:#888;">If the button doesn't work, copy this link:<br>
            <a href="${opts.ctaUrl}" style="color:#2d6a4f;">${opts.ctaUrl}</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f9f9;padding:24px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
          <p style="margin:0;">© ${new Date().getFullYear()} Hagrosphere. All rights reserved.</p>
          <p style="margin:8px 0 0;">Connecting Africa's agricultural ecosystem.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
