'use server';

import { db } from '@/lib/db';
import { invites } from '@/lib/auth-schema';
import { randomUUID } from 'crypto';

/**
 * Generates a human-readable invite code
 * Format: FLUXO-XXXXX (5 random chars)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding ambiguous chars
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `FLUXO-${code}`;
}

export type CreateInviteParams = {
  email?: string;
  expiresInDays?: number;
  maxUses?: number;
  createdBy?: string;
};

export type CreateInviteResult = {
  success: boolean;
  code?: string;
  error?: string;
};

/**
 * Creates a new invite code (admin function)
 */
export async function createInvite(params: CreateInviteParams = {}): Promise<CreateInviteResult> {
  const { email, expiresInDays, maxUses = 1, createdBy } = params;

  try {
    const code = generateInviteCode();
    const id = randomUUID();

    let expiresAt: Date | null = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    await db.insert(invites).values({
      id,
      code,
      email: email || null,
      createdBy: createdBy || null,
      expiresAt,
      maxUses,
      useCount: 0,
    });

    return { success: true, code };
  } catch (error) {
    console.error('Create invite error:', error);
    return { success: false, error: 'Erro ao criar convite' };
  }
}
