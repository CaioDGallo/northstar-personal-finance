'use server';

import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email/send';
import { t } from '@/lib/i18n/server-errors';
import { checkLoginRateLimit, checkPasswordResetRateLimit } from '@/lib/rate-limit';
import { getCurrentUserId } from '@/lib/auth';

/**
 * Validates rate limit and CAPTCHA before login
 * The actual authentication happens via NextAuth signIn on the client
 */
export async function validateLoginAttempt(email: string, captchaToken: string) {
  // Rate limiting
  const rateLimit = await checkLoginRateLimit();
  if (!rateLimit.allowed) {
    return {
      allowed: false,
      error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
    };
  }

  // Verify CAPTCHA
  try {
    const verifyResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: captchaToken,
        }),
      }
    );

    const verifyData = await verifyResponse.json();
    if (!verifyData.success) {
      return { allowed: false, error: await t('login.captchaFailed') };
    }

    return { allowed: true, error: null };
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return { allowed: false, error: await t('errors.unexpectedError') };
  }
}

/**
 * Forgot password - generates reset token and sends email
 */
export async function forgotPassword(email: string) {
  // Rate limiting
  const rateLimit = await checkPasswordResetRateLimit();
  if (!rateLimit.allowed) {
    return {
      error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
    };
  }

  try {
    // Find user (but don't leak if user exists)
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (user) {
      // Generate secure token
      const tokenId = crypto.randomUUID();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = await bcrypt.hash(rawToken, 10);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

      // Store hashed token
      await db.insert(passwordResetTokens).values({
        id: tokenId,
        userId: user.id,
        token: hashedToken,
        expires: expiresAt,
      });

      // Send email with raw token
      const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${tokenId}&code=${rawToken}`;

      await sendEmail({
        to: email,
        subject: 'Reset your password',
        html: `
          <p>You requested a password reset.</p>
          <p>Click the link below to reset your password (expires in 1 hour):</p>
          <p><a href="${resetUrl}">Reset Password</a></p>
          <p>If you didn't request this, ignore this email.</p>
        `,
        text: `Reset your password: ${resetUrl}`,
      });
    }

    // Always return success (prevent email enumeration)
    return { error: null };
  } catch (error) {
    console.error('Password reset error:', error);
    // Still return success (don't leak errors)
    return { error: null };
  }
}

/**
 * Update password with reset token
 */
export async function updatePasswordWithToken(
  tokenId: string,
  rawToken: string,
  newPassword: string
) {
  try {
    // Validate password requirements
    if (newPassword.length < 8) {
      return { error: await t('errors.passwordTooShort') };
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return { error: await t('errors.passwordRequirementsNotMet') };
    }

    // Find token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.id, tokenId),
    });

    if (!resetToken) {
      return { error: await t('errors.invalidOrExpiredToken') };
    }

    // Check expiry
    if (new Date() > resetToken.expires) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenId));
      return { error: await t('errors.invalidOrExpiredToken') };
    }

    // Verify token
    const tokenMatch = await bcrypt.compare(rawToken, resetToken.token);
    if (!tokenMatch) {
      return { error: await t('errors.invalidOrExpiredToken') };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password
    await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));

    // Delete used token
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, tokenId));

    return { error: null };
  } catch (error) {
    console.error('Update password error:', error);
    return { error: await t('errors.unexpectedError') };
  }
}

/**
 * Update password for authenticated user (change password while logged in)
 */
export async function updatePassword(newPassword: string) {
  try {
    const userId = await getCurrentUserId();

    // Validate password requirements
    if (newPassword.length < 8) {
      return { error: await t('errors.passwordTooShort') };
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return { error: await t('errors.passwordRequirementsNotMet') };
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    return { error: null };
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { error: await t('errors.notAuthenticated') };
    }
    console.error('Update password error:', error);
    return { error: await t('errors.unexpectedError') };
  }
}
