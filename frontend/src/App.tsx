import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { router } from './routes';
import { useAuthStore } from './stores/useAuthStore';

const queryClient = new QueryClient();

function App() {
    const initKeycloak = useAuthStore(state => state.initKeycloak);
    const isLoading = useAuthStore(state => state.isLoading);
    const initialized = useRef(false);

    useEffect(() => {
        // Prevent double initialization in StrictMode
        if (!initialized.current) {
            initialized.current = true;
            initKeycloak();
        }
    }, [initKeycloak]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-muted-foreground">読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
            <Toaster position="bottom-center" richColors />
        </QueryClientProvider>
    );
}

export default App;

