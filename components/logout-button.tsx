'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Logout01Icon } from '@hugeicons/core-free-icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type LogoutButtonProps = {
  variant: 'desktop' | 'mobile';
};

export function LogoutButton({ variant }: LogoutButtonProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);

  const handleLogout = () => {
    startTransition(async () => {
      const data = await signOut({ redirect: false, callbackUrl: '/login' });
      router.push(data.url);
    });
  };

  const buttonContent = (
    <>
      <HugeiconsIcon icon={Logout01Icon} className={variant === 'mobile' ? 'size-5' : undefined} />
      <span>{isPending ? t('common.loggingOut') : t('navigation.logout')}</span>
    </>
  );

  return (
    <>
      {variant === 'desktop' ? (
        <SidebarMenuButton onClick={() => setShowDialog(true)} disabled={isPending} tooltip={t('navigation.logout')}>
          {buttonContent}
        </SidebarMenuButton>
      ) : (
        <button
          onClick={() => setShowDialog(true)}
          disabled={isPending}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-md',
            'text-foreground hover:bg-muted transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {buttonContent}
        </button>
      )}

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('navigation.logoutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('navigation.logoutConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} disabled={isPending}>
              {isPending ? t('common.loggingOut') : t('navigation.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
