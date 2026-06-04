"use client";

import { ThemeProvider } from '../components/mvpblocks/theme-provider';
import { SiteTranslator } from '../components/ui/site-translator';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SiteTranslator />
      {children}
    </ThemeProvider>
  );
}
