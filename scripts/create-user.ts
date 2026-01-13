#!/usr/bin/env tsx

import 'dotenv/config';
import { db } from '@/lib/db';
import { users } from '@/lib/auth-schema';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface CreateUserArgs {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

async function createUser({ email, password, firstName, lastName }: CreateUserArgs) {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password requirements
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one letter and one number');
    }

    // Generate user ID
    const userId = crypto.randomUUID();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Build name from firstName and lastName
    let name: string | undefined;
    if (firstName && lastName) {
      name = `${firstName} ${lastName}`;
    } else if (firstName) {
      name = firstName;
    } else if (lastName) {
      name = lastName;
    }

    // Insert user
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        email,
        passwordHash,
        name,
      })
      .returning();

    console.log('✅ User created successfully!');
    console.log('User ID:', newUser.id);
    console.log('Email:', newUser.email);
    if (newUser.name) {
      console.log('Name:', newUser.name);
    }
    console.log('Created at:', newUser.createdAt);

    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ Error creating user:', error.message);

      // Show full error stack for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('\nFull error details:');
        console.error(error);
      }

      // Check for duplicate email error
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        console.error('This email is already registered.');
      }
    } else {
      console.error('❌ Unknown error:', error);
    }
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): CreateUserArgs | null {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: tsx scripts/create-user.ts --email <email> --password <password> [options]

Required:
  --email <email>          User email address
  --password <password>    User password (min 8 chars, must include letter and number)

Optional:
  --first-name <name>      User's first name
  --last-name <name>       User's last name
  -h, --help              Show this help message

Examples:
  tsx scripts/create-user.ts --email user@example.com --password Pass123!
  tsx scripts/create-user.ts --email user@example.com --password Pass123! --first-name John --last-name Doe
    `);
    return null;
  }

  const result: CreateUserArgs = {
    email: '',
    password: '',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        result.email = args[++i];
        break;
      case '--password':
        result.password = args[++i];
        break;
      case '--first-name':
        result.firstName = args[++i];
        break;
      case '--last-name':
        result.lastName = args[++i];
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        return null;
    }
  }

  if (!result.email || !result.password) {
    console.error('❌ Error: --email and --password are required');
    console.log('Run with --help for usage information');
    return null;
  }

  return result;
}

// Main execution
const args = parseArgs();
if (args) {
  createUser(args);
} else {
  process.exit(1);
}
