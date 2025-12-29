import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid gap-4">
        <Link
          href="/settings/accounts"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">Accounts</h2>
          <p className="text-sm text-gray-600">Manage bank accounts and credit cards</p>
        </Link>
        <Link
          href="/settings/categories"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">Categories</h2>
          <p className="text-sm text-gray-600">Manage expense categories</p>
        </Link>
        <Link
          href="/settings/budgets"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">Budgets</h2>
          <p className="text-sm text-gray-600">Set monthly budgets per category</p>
        </Link>
      </div>
    </div>
  );
}
