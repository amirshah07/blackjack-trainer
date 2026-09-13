import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Blackjack Trainer',
  description: 'Basic strategy and card counting practice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        {/* No-op unless deployed to Vercel, so local runs are unaffected. */}
        <Analytics />
      </body>
    </html>
  );
}
