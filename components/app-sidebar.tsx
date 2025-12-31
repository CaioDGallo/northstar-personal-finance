'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon,
  Invoice03Icon,
  Wallet01Icon,
  Settings01Icon,
  ArrowRight01Icon,
  SparklesIcon,
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

const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: Home01Icon },
  { title: 'Budgets', href: '/budgets', icon: Invoice03Icon },
  { title: 'Expenses', href: '/expenses', icon: Wallet01Icon },
  { title: 'Income', href: '/income', icon: Wallet01Icon },
];

const settingsItems = [
  { title: 'Accounts', href: '/settings/accounts', icon: Wallet01Icon },
  { title: 'Categories', href: '/settings/categories', icon: SparklesIcon },
  { title: 'Budgets', href: '/settings/budgets', icon: Invoice03Icon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  const isActive = (href: string) => pathname === href;
  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Expanded state: show full text */}
        <div className="flex h-12 items-center px-4 font-semibold group-data-[collapsible=icon]:hidden">
          Northstar
        </div>
        {/* Collapsed state: show clickable icon */}
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar} tooltip="Expand sidebar">
              <HugeiconsIcon icon={SparklesIcon} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href} prefetch={true}>
                      <HugeiconsIcon icon={item.icon} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <Collapsible defaultOpen={isSettingsActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isSettingsActive}>
                      <HugeiconsIcon icon={Settings01Icon} />
                      <span>Settings</span>
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
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
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
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
