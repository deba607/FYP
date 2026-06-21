'use client';

import { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '../mvpblocks/theme-provider';
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
  SidebarRail,
} from './sidebar';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Activity,
  Database,
  Shield,
  Moon,
  Sun,
  User,
  Ticket,
  Home,
  Landmark,
  Gamepad2,
} from 'lucide-react';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '#dashboard' },
  { title: 'Bookings', icon: Ticket, href: '#bookings' },
  { title: 'Museums', icon: Landmark, href: '#museums' },
  { title: 'User Management', icon: Users, href: '#users' },
  { title: 'Analytics', icon: BarChart3, href: '#analytics' },
  { title: 'Visitors', icon: Users, href: '#visitors' },
  { title: 'Activity', icon: Activity, href: '#activity' },
  { title: 'Quiz Manager', icon: Gamepad2, href: '#quiz' },
];

export const AdminSidebar = memo(() => {
  const { theme, setTheme } = useTheme();
  const [activeHash, setActiveHash] = useState('#dashboard');

  const changeSection = (href: string) => {
    setActiveHash(href);
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', href);
    window.dispatchEvent(new Event('hashchange'));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      setActiveHash(window.location.hash || '#dashboard');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => changeSection('#dashboard')}>
              <>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Bharat Museum</span>
                  <span className="truncate text-xs">Admin Dashboard</span>
                </div>
              </>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={item.href === activeHash}
                      onClick={() => changeSection(item.href)}
                    >
                      <>
                        <Icon />
                        <span>{item.title}</span>
                      </>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href={'/' as any}>
                <Home />
                <span>Back to Site</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href={'/profile' as any}>
                <User />
                <span>Admin Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
});

AdminSidebar.displayName = 'AdminSidebar';
