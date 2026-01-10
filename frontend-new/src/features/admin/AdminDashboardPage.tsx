import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, CheckCircle, Clock, AlertTriangle, Users, Settings, LayoutDashboard, ClipboardList } from 'lucide-react';

interface DashboardStats {
    applications: { total: number; pending: number; approved: number; rejected: number };
    tasks: { total: number; pending: number };
    appDefinitions: { total: number; active: number };
}

export default function AdminDashboardPage() {
    // Fetch stats
    const { data: appStats, isLoading: loadingApps } = useQuery({
        queryKey: ['admin-apps-stats'],
        queryFn: () => api.get<{ total: number }>('/applications?limit=1'),
    });

    const { data: taskStats, isLoading: loadingTasks } = useQuery({
        queryKey: ['admin-tasks-stats'],
        queryFn: () => api.get<{ total: number }>('/tasks?status=PENDING&limit=1'),
    });

    const { data: appDefStats, isLoading: loadingDefs } = useQuery({
        queryKey: ['admin-appdefs-stats'],
        queryFn: () => api.get<{ total: number }>('/application-definitions?limit=1'),
    });

    const isLoading = loadingApps || loadingTasks || loadingDefs;

    const statCards = [
        { title: '申請総数', value: appStats?.total || 0, icon: FileText, color: 'bg-blue-500', link: '/admin/workflows' },
        { title: '未処理タスク', value: taskStats?.total || 0, icon: Clock, color: 'bg-amber-500', link: '/admin/tasks' },
        { title: 'アプリ定義', value: appDefStats?.total || 0, icon: Settings, color: 'bg-purple-500', link: '/designer/apps' },
    ];

    const quickLinks = [
        { title: 'ワークフロー管理', description: '全申請の進捗を確認', icon: ClipboardList, href: '/admin/workflows' },
        { title: 'タスク管理', description: '滞留タスクの確認と介入', icon: LayoutDashboard, href: '/admin/tasks' },
        { title: 'チーム管理', description: 'チーム・部署の管理', icon: Users, href: '/admin/teams' },
        { title: 'App Studio', description: 'アプリ定義の作成・編集', icon: Settings, href: '/designer/apps' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">管理ダッシュボード</h2>
                <p className="text-muted-foreground">システム全体の状況を確認できます</p>
            </div>

            {/* Stats */}
            {isLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
                <div className="grid gap-4 md:grid-cols-3">
                    {statCards.map((stat, i) => (
                        <Card key={i} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                                <div className={`p-2 rounded-lg ${stat.color}`}>
                                    <stat.icon className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stat.value}</div>
                                <Button variant="link" className="p-0 h-auto mt-2" asChild>
                                    <Link to={stat.link}>詳細を見る →</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Quick Links */}
            <div>
                <h3 className="text-xl font-semibold mb-4">クイックアクセス</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {quickLinks.map((link, i) => (
                        <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer" onClick={() => window.location.href = link.href}>
                            <CardHeader className="pb-2">
                                <div className="p-2 rounded-lg bg-primary/10 w-fit">
                                    <link.icon className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-base mt-2">{link.title}</CardTitle>
                                <CardDescription>{link.description}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
