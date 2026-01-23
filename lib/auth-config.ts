import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { User as NextAuthUser } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { db } from '@/lib/db';
import { users } from '@/lib/auth-schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { setupNewUser } from '@/lib/user-setup/setup-new-user';
import { getStoredInviteCode, clearStoredInviteCode, validateInviteCode } from '@/lib/actions/signup';
import { invites } from '@/lib/auth-schema';

// Extended user type with invite tracking
interface ExtendedUser extends NextAuthUser {
  inviteId?: string;
}

export const authConfig: NextAuthOptions = {
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Allow credentials login (existing users)
      if (account?.provider === 'credentials') {
        return true;
      }

      // OAuth login/signup
      if (account?.provider === 'google' || account?.provider === 'github') {
        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, user.email as string),
        });

        // Existing user - allow login
        if (existingUser) {
          return true;
        }

        // New user - check for invite code
        const inviteCode = await getStoredInviteCode();
        if (!inviteCode) {
          console.log('[AUTH] OAuth signup rejected - no invite code');
          return '/login?error=auth_failed';
        }

        // Validate invite
        const validation = await validateInviteCode(inviteCode, user.email as string);
        if (!validation.valid) {
          console.log('[AUTH] OAuth signup rejected - invalid invite:', validation.error);
          await clearStoredInviteCode();
          return '/login?error=auth_failed';
        }

        // Store invite ID in user object for jwt callback
        (user as ExtendedUser).inviteId = validation.inviteId;

        return true;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // OAuth signup/login
        if (account?.provider && (account.provider === 'google' || account.provider === 'github')) {
          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, user.email as string),
          });

          if (existingUser) {
            // Existing user - just set token ID
            token.id = existingUser.id;
          } else {
            // New OAuth user - create in database
            console.log('[AUTH] Creating new OAuth user:', user.email);
            const { randomUUID } = await import('crypto');
            const userId = randomUUID();

            await db.insert(users).values({
              id: userId,
              email: user.email as string,
              name: user.name || null,
              image: user.image || null,
              emailVerified: new Date(), // OAuth emails are pre-verified
              passwordHash: '', // No password for OAuth users
            });

            token.id = userId;

            // Setup default categories and accounts
            await setupNewUser(userId);

            // Mark invite as used
            const inviteId = (user as ExtendedUser).inviteId;
            if (inviteId) {
              const currentInvite = await db.query.invites.findFirst({
                where: eq(invites.id, inviteId),
              });

              if (currentInvite) {
                await db
                  .update(invites)
                  .set({
                    useCount: (currentInvite.useCount || 0) + 1,
                    usedAt: new Date(),
                    usedBy: userId,
                  })
                  .where(eq(invites.id, inviteId));
              }

              // Clear cookie
              await clearStoredInviteCode();
            }
          }
        } else {
          // Credentials login - user already exists in DB
          token.id = user.id;
        }
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
