import type React from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
        <title>VaraΞDEX - Decentralized Exchange</title>
        <meta name="description" content="Trade, explore, and provide liquidity on Vara Network" />
      </head>
      <body className="font-roboto antialiased min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
