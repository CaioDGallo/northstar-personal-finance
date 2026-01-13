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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // E2E bypass
        if (process.env.E2E_AUTH_BYPASS === 'true' && process.env.E2E_AUTH_USER_ID) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, process.env.E2E_AUTH_USER_ID),
          });
          return user || null;
        }

        // Verify CAPTCHA token if not E2E
        if (process.env.E2E_AUTH_BYPASS !== 'true') {
          const captchaToken = credentials.captchaToken as string;
          if (!captchaToken) {
            return null;
          }

          // Verify with Cloudflare Turnstile
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
            return null;
          }
        }

        // Find user by email
        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordMatch) {
          return null;
        }

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
