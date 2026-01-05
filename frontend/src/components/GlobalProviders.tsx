'use client';

import ThemeRegistryProvider from "@/lib/ThemeRegistryProvider";
import Providers from "@/lib/QueryProvider";
import AppLayout from "@/components/AppLayout";
import { AuthProvider } from "@/providers/AuthProvider";

export default function GlobalProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Providers>
        <ThemeRegistryProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </ThemeRegistryProvider>
      </Providers>
    </AuthProvider>
  );
}
