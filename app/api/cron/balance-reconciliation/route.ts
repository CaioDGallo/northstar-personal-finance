import { NextResponse } from 'next/server';
import { reconcileAllAccountBalances } from '@/lib/actions/accounts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await reconcileAllAccountBalances();

    return NextResponse.json({
      success: true,
      users: result.users,
      accounts: result.accounts,
    });
  } catch (error) {
    console.error('[cron:balance-reconciliation] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
