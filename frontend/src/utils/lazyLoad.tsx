import { Suspense } from "react";
import { Loader2 } from "lucide-react";

// Loading component
export const PageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[50vh] w-full">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
    </div>
);

// HOC for Lazy Loading
export const Loadable = <P extends object>(Component: React.ComponentType<P>) => (props: P) => (
    <Suspense fallback={<PageLoader />}>
        <Component {...props} />
    </Suspense>
);
