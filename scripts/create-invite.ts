#!/usr/bin/env tsx

import 'dotenv/config';
import { createInviteWithoutAuth } from '@/lib/actions/invite';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    email: { type: 'string', short: 'e' },
    expires: { type: 'string', short: 'x', default: '30' },
    maxUses: { type: 'string', short: 'm', default: '1' },
  },
});

async function main() {
  const email = values.email;
  const expiresInDays = parseInt(values.expires || '30', 10);
  const maxUses = parseInt(values.maxUses || '1', 10);

  console.log('Creating invite code...');
  console.log('Email restriction:', email || 'None');
  console.log('Expires in:', expiresInDays, 'days');
  console.log('Max uses:', maxUses);
  console.log('');

  const result = await createInviteWithoutAuth({
    email,
    expiresInDays,
    maxUses,
    createdById: null,
  });

  if (result.success) {
    console.log('✓ Invite code created successfully!');
    console.log('');
    console.log('Code:', result.code);
    console.log('');
    console.log('Share this code with the user to allow them to sign up.');
  } else {
    console.error('✗ Failed to create invite:', result.error);
    process.exit(1);
  }
}

main();
