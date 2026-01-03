'use client';

import { Inter } from "next/font/google";
import ThemeRegistryProvider from "@/lib/ThemeRegistryProvider";
import Providers from "@/lib/QueryProvider";
import AppLayout from "@/components/AppLayout";
import { AuthProvider } from "@/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>Flow Craft</title>
        <meta name="description" content="Workflow System" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <Providers>
            <ThemeRegistryProvider>
              <AppLayout>
                {children}
              </AppLayout>
            </ThemeRegistryProvider>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
