'use server';

import { db } from '@/lib/db';
import { users, invites } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { setupNewUser } from '@/lib/user-setup/setup-new-user';
import { checkSignupRateLimit } from '@/lib/rate-limit';

const INVITE_COOKIE_NAME = 'invite_code';
const INVITE_COOKIE_MAX_AGE = 60 * 60; // 1 hour

export type InviteValidationResult =
  | { valid: true; inviteId: string }
  | { valid: false; error: string };

/**
 * Validates an invite code
 * Checks if code exists, not expired, not fully used, and matches email (if restricted)
 */
export async function validateInviteCode(
  code: string,
  email?: string
): Promise<InviteValidationResult> {
  const invite = await db.query.invites.findFirst({
    where: eq(invites.code, code.trim().toUpperCase()),
  });

  if (!invite) {
    return { valid: false, error: 'Código de convite inválido' };
  }

  // Check if expired
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { valid: false, error: 'Código de convite expirado' };
  }

  // Check if fully used
  const maxUses = invite.maxUses || 1;
  if (invite.useCount >= maxUses) {
    return { valid: false, error: 'Código de convite já foi utilizado' };
  }

  // Check if email-restricted
  if (invite.email && email && invite.email.toLowerCase() !== email.toLowerCase()) {
    return { valid: false, error: 'Este convite não é válido para este e-mail' };
  }

  return { valid: true, inviteId: invite.id };
}

export type SignupResult =
  | { success: true; userId: string }
  | { success: false; error: string };

/**
 * Creates a new user account with email/password
 * Requires valid invite code
 */
export async function signup(data: {
  email: string;
  password: string;
  name: string;
  inviteCode: string;
  captchaToken: string;
}): Promise<SignupResult> {
  const { email, password, name, inviteCode, captchaToken } = data;

  // Check rate limit
  const rateLimit = await checkSignupRateLimit();
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Muitas tentativas. Tente novamente em ${rateLimit.retryAfter}s.`,
    };
  }

  // Validate CAPTCHA
  const captchaValid = await verifyCaptcha(captchaToken);
  if (!captchaValid) {
    return { success: false, error: 'Falha na verificação do captcha' };
  }

  // Validate invite
  const inviteValidation = await validateInviteCode(inviteCode, email);
  if (!inviteValidation.valid) {
    return { success: false, error: inviteValidation.error };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (existingUser) {
    return { success: false, error: 'E-mail já cadastrado' };
  }

  // Validate password strength
  if (password.length < 8) {
    return { success: false, error: 'Senha deve ter no mínimo 8 caracteres' };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, error: 'Senha deve conter letras e números' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Create user
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      name,
      passwordHash,
      emailVerified: null, // Skip email verification for now
    });

    // Setup default accounts and categories
    await setupNewUser(userId);

    // Mark invite as used
    const currentInvite = await db.query.invites.findFirst({
      where: eq(invites.id, inviteValidation.inviteId),
    });

    await db
      .update(invites)
      .set({
        useCount: (currentInvite?.useCount || 0) + 1,
        usedAt: new Date(),
        usedBy: userId,
      })
      .where(eq(invites.id, inviteValidation.inviteId));

    return { success: true, userId };
  } catch (error) {
    console.error('Signup error:', error);
    return { success: false, error: 'Erro ao criar conta. Tente novamente.' };
  }
}

/**
 * Stores invite code in cookie for OAuth flow
 * OAuth callback will validate and use this invite
 */
export async function reserveInviteForOAuth(code: string): Promise<{ success: boolean; error?: string }> {
  // Validate invite exists and is available
  const validation = await validateInviteCode(code);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Store in httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(INVITE_COOKIE_NAME, code.trim().toUpperCase(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: '/',
  });

  return { success: true };
}

/**
 * Gets stored invite code from OAuth flow cookie
 */
export async function getStoredInviteCode(): Promise<string | null> {
  const cookieStore = await cookies();
  const invite = cookieStore.get(INVITE_COOKIE_NAME);
  return invite?.value || null;
}

/**
 * Clears the stored invite code cookie
 */
export async function clearStoredInviteCode(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE_NAME);
}

/**
 * Verifies Cloudflare Turnstile CAPTCHA token
 */
async function verifyCaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return false;
  }
}
