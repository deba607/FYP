import './globals.css';
import { Providers } from './providers';
import { AppShell } from './app-shell';
import { RuntimeEventGuard } from './runtime-event-guard';

export const metadata = {
  title: 'Bharat Museum Tickets',
  description: 'Cultural heritage ticketing experience',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <RuntimeEventGuard />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
