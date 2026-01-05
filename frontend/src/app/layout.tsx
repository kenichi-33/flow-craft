import { Inter } from "next/font/google";
import GlobalProviders from "@/components/GlobalProviders";
import type { Metadata } from 'next';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Flow Craft',
  description: 'Workflow System',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <GlobalProviders>
          {children}
        </GlobalProviders>
      </body>
    </html>
  );
}
