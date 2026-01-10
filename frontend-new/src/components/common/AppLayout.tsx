import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Menu, Home, FileText, ClipboardList, LayoutDashboard, Database, Settings, Users, FolderOpen, LogOut, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppLayout() {
    const { user, logout, hasRole } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    // Reset Sheet state on route change to prevent dark overlay issues
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);

    // Menu Item Definition
    const menuGroups = [
        {
            title: '利用者メニュー',
            items: [
                { title: 'ホーム', href: '/', icon: Home },
                { title: '新規申請', href: '/applications/new', icon: FileText },
                { title: '申請一覧', href: '/applications', icon: ClipboardList },
                { title: 'タスク', href: '/tasks', icon: LayoutDashboard },
            ]
        },
        hasRole('wf_manager') && {
            title: '設計者メニュー',
            items: [
                { title: 'アプリ管理', href: '/designer/apps', icon: Database },
            ]
        },
        hasRole('wf_manager') && {
            title: '管理者メニュー',
            items: [
                { title: 'ダッシュボード', href: '/admin', icon: LayoutDashboard },
                { title: '進捗一覧', href: '/admin/workflows', icon: FolderOpen },
                { title: 'タスク管理', href: '/admin/tasks', icon: Settings },
                hasRole('wf_admin') && { title: 'チーム管理', href: '/admin/teams', icon: Users },
                hasRole('wf_admin') && { title: 'ユーザー管理', href: '/admin/users', icon: Users },
            ].filter(Boolean) as any[]
        }
    ].filter(Boolean) as { title: string, items: { title: string, href: string, icon: any }[] }[];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const UserMenu = () => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src="/avatars/01.png" alt={user?.username} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-semibold">
                            {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 shadow-lg" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-4">
                    <div className="flex flex-col space-y-1">
                        <p className="text-base font-semibold leading-none">{user?.firstName} {user?.lastName}</p>
                        <p className="text-sm leading-none text-muted-foreground">@{user?.username}</p>
                        <p className="text-xs leading-none text-muted-foreground pt-1">{user?.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    ログアウト
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const SidebarContent = () => (
        <div className="flex h-full flex-col">
            {/* Logo Area */}
            <div className="flex items-center h-16 px-6 border-b border-border/40">
                <img src="/flow-claft-top.svg" alt="Flow Craft" className="h-8" />
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto py-4 px-3">
                {menuGroups.map((group, i) => (
                    <div key={i} className="mb-6">
                        <h4 className="mb-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {group.title}
                        </h4>
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                // Fix: Use exact match for specific routes, prevent parent path from being selected
                                const isExactMatch = location.pathname === item.href;
                                // For prefix match, ensure it's a real child path (followed by /)
                                const isPrefixMatch = item.href !== '/' && 
                                    item.href !== '/admin' && // Admin dashboard exact match only
                                    item.href !== '/applications' && // Application list exact match only
                                    location.pathname.startsWith(item.href + '/');
                                const isActive = isExactMatch || isPrefixMatch;
                                return (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        onClick={() => setOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                            isActive 
                                                ? "bg-primary text-primary-foreground shadow-md" 
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5", isActive && "text-primary-foreground")} />
                                        <span className="flex-1">{item.title}</span>
                                        {isActive && <ChevronRight className="h-4 w-4" />}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* User Info Footer */}
            <div className="border-t border-border/40 p-4">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
                            {user?.firstName?.[0] || user?.username?.[0] || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen w-full bg-muted/30">
            {/* Desktop Sidebar */}
            <aside className="hidden w-64 flex-col bg-card border-r shadow-sm md:flex">
                <SidebarContent />
            </aside>

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <header className="flex h-16 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-6 shadow-sm">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">メニュー</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 p-0">
                            <SheetHeader className="sr-only">
                                <SheetTitle>ナビゲーションメニュー</SheetTitle>
                            </SheetHeader>
                            <SidebarContent />
                        </SheetContent>
                    </Sheet>

                    <div className="flex flex-1 items-center gap-4">
                        {/* Page Title / Breadcrumb Area */}
                        <h1 className="text-lg font-semibold text-foreground hidden md:block">
                            {/* Dynamic page title could be added here */}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {user?.roles?.includes('wf_admin') && (
                            <Badge variant="destructive" className="shadow-sm">管理者</Badge>
                        )}
                        {user?.roles?.includes('wf_manager') && !user?.roles?.includes('wf_admin') && (
                            <Badge variant="secondary" className="shadow-sm">マネージャー</Badge>
                        )}
                        <UserMenu />
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-auto bg-muted/30">
                    <div className="container mx-auto p-6 md:p-8 max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
