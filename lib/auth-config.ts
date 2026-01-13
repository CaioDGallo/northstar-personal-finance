import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/lib/auth-schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

export const authConfig: NextAuthOptions = {
  // adapter: DrizzleAdapter(db, {
  //   usersTable: users,
  //   accountsTable: authAccounts,
  //   sessionsTable: sessions,
  //   verificationTokensTable: verificationTokens,
  // }),

  // JWT session strategy (adapter commented out for now)
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        captchaToken: { label: 'CAPTCHA', type: 'text' },
      },
      async authorize(credentials) {
        console.log('[AUTH] authorize called with credentials:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          hasCaptcha: !!credentials?.captchaToken
        });

        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing email or password');
          return null;
        }

        // E2E bypass
        if (process.env.E2E_AUTH_BYPASS === 'true' && process.env.E2E_AUTH_USER_ID) {
          console.log('[AUTH] Using E2E bypass');
          const user = await db.query.users.findFirst({
            where: eq(users.id, process.env.E2E_AUTH_USER_ID),
          });
          return user || null;
        }

        // CAPTCHA already verified by validateLoginAttempt server action
        // No need to verify again here

        // Find user by email
        console.log('[AUTH] Looking up user by email:', credentials.email);
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user) {
          console.log('[AUTH] User not found');
          return null;
        }

        if (!user.passwordHash) {
          console.log('[AUTH] User has no password hash');
          return null;
        }

        console.log('[AUTH] Verifying password...');
        // Verify password
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordMatch) {
          console.log('[AUTH] Password mismatch');
          return null;
        }

        console.log('[AUTH] Login successful for:', user.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};
