import { getAccounts, deleteAccount } from '@/lib/actions/accounts';
import { AccountForm } from '@/components/account-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Add Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Account</AlertDialogTitle>
            </AlertDialogHeader>
            <AccountForm />
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => (
          <Card key={account.id} className="flex items-center justify-between p-4">
            <div>
              <h3 className="font-medium">{account.name}</h3>
              <p className="text-sm text-neutral-500 capitalize">
                {account.type.replace('_', ' ')}
              </p>
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">Edit</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Edit Account</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AccountForm account={account} />
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <form action={deleteAccount.bind(null, account.id)}>
                      <AlertDialogAction type="submit">Delete</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
