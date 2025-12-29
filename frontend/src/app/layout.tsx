import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeRegistryProvider from "@/lib/ThemeRegistryProvider";
import Providers from "@/lib/QueryProvider";
import AppLayout from "@/components/AppLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flow Craft",
  description: "Workflow System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ThemeRegistryProvider>
            <AppLayout>
              {children}
            </AppLayout>
          </ThemeRegistryProvider>
        </Providers>
      </body>
    </html>
  );
}
