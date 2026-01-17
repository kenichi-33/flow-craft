import { useState } from 'react';
import { Outlet, Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    LayoutDashboard, FileEdit, GitBranch, Search, History,
    ArrowLeft, Menu, Rocket, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DRAWER_WIDTH = 240;

interface AppDefinition {
    id: number;
    name: string;
    appName?: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    version: number;
    updatedAt: string;
    formDefinition?: any;
    flowDefinition?: any;
}

export default function AppStudioLayout() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);
    const [publishComment, setPublishComment] = useState('');

    const { data: app, isLoading } = useQuery<AppDefinition>({
        queryKey: ['application-definition', id],
        queryFn: () => api.get<AppDefinition>(`/application-definitions/${id}`),
        enabled: !!id,
        staleTime: 0,
    });

    const { data: versions } = useQuery<any[]>({
        queryKey: ['app-versions', id],
        queryFn: () => api.get(`/application-definitions/${id}/versions`),
        enabled: !!id,
    });

    const currentMaxVersion = versions && Array.isArray(versions) && versions.length > 0
        ? Math.max(...versions.map((v: any) => v.version || 0))
        : 0;
    const nextVersion = currentMaxVersion + 1;

    const publishMutation = useMutation({
        mutationFn: () => api.post(`/application-definitions/${id}/publish`, { comment: publishComment }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', id] });
            queryClient.invalidateQueries({ queryKey: ['app-versions', id] });
            toast.success('新しいバージョンを公開しました');
            setPublishDialogOpen(false);
            setPublishComment('');
        },
        onError: (err: any) => {
            toast.error('公開に失敗しました: ' + (err.message || 'Unknown error'));
        },
    });

    const menuItems = [
        { text: '概観 (Overview)', icon: LayoutDashboard, href: `/designer/apps/${id}` },
        { text: 'フォーム定義', icon: FileEdit, href: `/designer/apps/${id}/form` },
        { text: 'フロー定義', icon: GitBranch, href: `/designer/apps/${id}/flow` },
        { text: 'データ検索', icon: Search, href: `/designer/apps/${id}/search` },
        { text: 'バージョン履歴', icon: History, href: `/designer/apps/${id}/versions` },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!app) {
        return <div className="flex items-center justify-center h-screen">アプリが見つかりません</div>;
    }

    const canPublish = app.formDefinition && app.flowDefinition;

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside className={cn(
                "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-200",
                sidebarOpen ? "w-60" : "w-0 overflow-hidden"
            )}>
                <div className="flex h-16 items-center justify-between px-4 border-b">
                    <span className="font-bold text-lg">App Studio</span>
                    <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                        <Menu className="h-4 w-4" />
                    </Button>
                </div>
                <nav className="flex-1 p-2 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.text}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.text}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main */}
            <div className={cn("flex-1 flex flex-col transition-all duration-200", sidebarOpen ? "ml-60" : "ml-0")}>
                {/* Header */}
                <header className="h-16 border-b bg-card flex items-center px-4 gap-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                            <Link to="/designer/apps"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        {!sidebarOpen && (
                            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
                                <Menu className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                        <h1 className="text-lg font-semibold">{app.name || app.appName}</h1>
                        <Badge variant={app.status === 'ACTIVE' ? 'default' : 'outline'}>
                            {app.status === 'ACTIVE' ? '公開中' : app.status === 'DRAFT' ? '下書き' : 'アーカイブ'}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden md:inline">
                            最終保存: {new Date(app.updatedAt).toLocaleString('ja-JP')}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => setPublishDialogOpen(true)}
                        disabled={publishMutation.isPending || !canPublish}
                    >
                        <Rocket className="h-4 w-4 mr-1" />
                        新バージョン公開
                    </Button>
                </header>

                {/* Content */}
                <main className="flex-1 overflow-auto p-6 bg-muted/30">
                    <Outlet />
                </main>
            </div>

            {/* Publish Dialog */}
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <div className="mx-auto p-4 rounded-full bg-emerald-100 text-emerald-600 mb-4">
                            <Rocket className="h-12 w-12" />
                        </div>
                        <DialogTitle className="text-center text-xl">新しいバージョンを公開しますか？</DialogTitle>
                        <DialogDescription className="text-center">
                            現在の「下書き」の設定を保存し、新しいバージョンとして公開します。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center items-center gap-4 py-4">
                        <Badge variant="outline">{currentMaxVersion > 0 ? `現在: v${currentMaxVersion}` : '初回公開'}</Badge>
                        <span className="text-xl text-muted-foreground">→</span>
                        <Badge className="bg-primary">新規: v{nextVersion}</Badge>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                        ※ 公開後は新規申請にこの設定が適用されます。
                    </p>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="publish-comment">コメント（任意）</Label>
                        <Textarea
                            id="publish-comment"
                            placeholder="バージョン変更の概要を入力"
                            value={publishComment}
                            onChange={(e) => setPublishComment(e.target.value)}
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>キャンセル</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                            {publishMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            公開する
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
