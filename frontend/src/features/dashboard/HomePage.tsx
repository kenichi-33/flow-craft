import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ClipboardList, LayoutDashboard, Settings, ArrowRight, Loader2 } from 'lucide-react';

interface StatsResponse {
    pendingTasks: number;
    monthlyApplications: number;
    approvedApplications: number;
}

export default function HomePage() {
    const { user, hasRole } = useAuthStore();

    // Fetch real statistics from API
    const { data: stats, isLoading: statsLoading } = useQuery<StatsResponse>({
        queryKey: ['home-stats'],
        queryFn: async () => {
            // Fetch pending tasks count (my tasks)
            const tasksRes = await api.get<{ pagination: { total: number } }>('/tasks?myTasks=true&status=PENDING&limit=1');
            
            // Fetch monthly applications (my applications this month)
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const applicationsRes = await api.get<{ pagination: { total: number } }>(`/applications?myApplications=true&dateFrom=${startOfMonth}&limit=1`);
            
            // Fetch approved applications (my applications that are approved)
            const approvedRes = await api.get<{ pagination: { total: number } }>('/applications?myApplications=true&status=APPROVED&limit=1');

            return {
                pendingTasks: tasksRes.pagination?.total || 0,
                monthlyApplications: applicationsRes.pagination?.total || 0,
                approvedApplications: approvedRes.pagination?.total || 0,
            };
        },
        staleTime: 30000, // Cache for 30 seconds
    });

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'おはようございます';
        if (hour < 18) return 'こんにちは';
        return 'こんばんは';
    };

    const quickActions = [
        {
            title: '新規申請',
            description: '新しい申請書を作成します',
            href: '/applications/new',
            icon: FileText,
            color: 'from-blue-500 to-blue-600',
        },
        {
            title: 'タスク一覧',
            description: '承認待ちのタスクを確認',
            href: '/tasks',
            icon: ClipboardList,
            color: 'from-emerald-500 to-emerald-600',
        },
        {
            title: '申請履歴',
            description: '過去の申請を確認',
            href: '/applications',
            icon: LayoutDashboard,
            color: 'from-orange-500 to-orange-600',
        },
    ];

    if (hasRole('wf_manager')) {
        quickActions.push({
            title: 'アプリ管理',
            description: 'アプリケーションを管理',
            href: '/designer/apps',
            icon: Settings,
            color: 'from-purple-500 to-purple-600',
        });
    }

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl p-8">
                <h1 className="text-3xl font-bold tracking-tight">
                    {getGreeting()}、{user?.firstName || user?.username}さん
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    今日も素敵な一日をお過ごしください
                </p>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {quickActions.map((action) => (
                        <Link key={action.href} to={action.href} className="group">
                            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-0 shadow-md overflow-hidden">
                                <div className={`h-2 bg-gradient-to-r ${action.color}`} />
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${action.color} shadow-lg`}>
                                            <action.icon className="h-5 w-5 text-white" />
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardTitle className="text-base mb-1">{action.title}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{action.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Stats Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4">概要</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-0 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">未処理タスク</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.pendingTasks ?? '-'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">件の承認待ち</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">今月の申請</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">
                                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.monthlyApplications ?? '-'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">件を申請</p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">承認済み</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-emerald-600">
                                {statsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.approvedApplications ?? '-'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">件が完了</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
