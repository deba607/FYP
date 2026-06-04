"use client";

import { usePathname } from 'next/navigation';
import Header2 from '../components/mvpblocks/header-2';
import Footer4Col from '../components/mvpblocks/footer-4col';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Header2 />
      <main className="min-h-screen pt-16 lg:pt-20">{children}</main>
      <Footer4Col />
    </>
  );
}

