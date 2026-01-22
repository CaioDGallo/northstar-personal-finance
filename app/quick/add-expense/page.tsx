import { redirect } from 'next/navigation';

export default function QuickAddExpense() {
  redirect('/expenses?add=true');
}
