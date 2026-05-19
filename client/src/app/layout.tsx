import './globals.css';
import Header2 from '../components/mvpblocks/header-2';
import Footer4Col from '../components/mvpblocks/footer-4col';
import { Providers } from './providers';

export const metadata = {
  title: 'Bharat Museum Tickets',
  description: 'Cultural heritage ticketing experience',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Header2 />
          <main className="min-h-screen">{children}</main>
          <Footer4Col />
        </Providers>
      </body>
    </html>
  );
}
