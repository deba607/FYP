"use client";

import { ThemeProvider } from '../components/mvpblocks/theme-provider';
import { SiteTranslator } from '../components/ui/site-translator';
import { ActivityTracker } from '../components/ui/activity-tracker';
import { AccessibilityProvider } from '../context/AccessibilityContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AccessibilityProvider>
        <SiteTranslator />
        <ActivityTracker />
        {children}
      </AccessibilityProvider>
    </ThemeProvider>
  );
}
