'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon,
  Invoice03Icon,
  Wallet01Icon,
  Settings01Icon,
  ArrowRight01Icon,
  SparklesIcon,
  CreditCardIcon,
  CalendarIcon,
  Calendar03Icon,
  ArrowLeftRightIcon,
  Notification02Icon,
  Settings02Icon,
  FileDownloadIcon,
} from '@hugeicons/core-free-icons';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageToggleSidebar } from '@/components/language-toggle-sidebar';
import { LogoutButton } from '@/components/logout-button';

const navItems = [
  { key: 'dashboard', href: '/dashboard', icon: Home01Icon },
  { key: 'budgets', href: '/budgets', icon: Invoice03Icon },
  { key: 'expenses', href: '/expenses', icon: Wallet01Icon },
  { key: 'transfers', href: '/transfers', icon: ArrowLeftRightIcon },
  { key: 'income', href: '/income', icon: Wallet01Icon },
  { key: 'calendar', href: '/calendar', icon: CalendarIcon },
  { key: 'reminders', href: '/reminders', icon: Notification02Icon },
  { key: 'faturas', href: '/faturas', icon: CreditCardIcon },
];

const settingsItems = [
  { key: 'accounts', href: '/settings/accounts', icon: Wallet01Icon },
  { key: 'categories', href: '/settings/categories', icon: SparklesIcon },
  { key: 'budgets', href: '/settings/budgets', icon: Invoice03Icon },
  { key: 'calendars', href: '/settings/calendars', icon: Calendar03Icon },
  { key: 'preferences', href: '/settings/preferences', icon: Notification02Icon },
  { key: 'export', href: '/settings/export', icon: FileDownloadIcon },
  { key: 'settings', href: '/settings/data', icon: Settings02Icon },
];

export function AppSidebar() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  const isActive = (href: string) => pathname === href;
  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Expanded state: show full text */}
        <div className="flex h-12 items-center px-4 font-semibold group-data-[collapsible=icon]:hidden">
          {t('fluxosh')}
        </div>
        {/* Collapsed state: show clickable icon */}
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} tooltip={t('expandSidebar')}>
              <HugeiconsIcon icon={SparklesIcon} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href} prefetch={true}>
                      <HugeiconsIcon icon={item.icon} />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <Collapsible defaultOpen={isSettingsActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isSettingsActive}>
                      <HugeiconsIcon icon={Settings01Icon} />
                      <span>{t('settings')}</span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href} prefetch={true}>
                              <HugeiconsIcon icon={item.icon} />
                              <span>{t(item.key)}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                      <SidebarMenuSubItem>
                        <ThemeToggle />
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <LanguageToggleSidebar />
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutButton variant="desktop" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
