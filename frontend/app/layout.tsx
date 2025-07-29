import type { Metadata } from 'next';
import { Roboto, Roboto_Mono } from 'next/font/google';
import type React from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-roboto',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
});

export const metadata: Metadata = {
  title: 'VaraΞDEX - Decentralized Exchange',
  description: 'Trade, explore, and provide liquidity on Vara Network',
  generator: 'v0.dev',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable}`}>
      <body className="font-roboto antialiased min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
