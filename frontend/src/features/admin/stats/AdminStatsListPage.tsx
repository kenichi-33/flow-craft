import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CheckCircle, Activity, ArrowRight } from 'lucide-react';

interface AppStatsSummary {
    id: string;
    name: string;
    status: string;
    updatedAt: string;
    stats: {
        totalCount: number;
        activeCount: number;
        approvedCount: number;
    };
}

export default function AdminStatsListPage() {
    const navigate = useNavigate();

    const { data: apps, isLoading, error } = useQuery<AppStatsSummary[]>({
        queryKey: ['admin-stats-apps'],
        queryFn: () => api.get('/statistics/applications'),
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error) return <div className="p-8 text-destructive">統計データの読み込みに失敗しました</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">アプリ利用統計</h2>
                <p className="text-muted-foreground">各アプリケーションの稼働状況と利用統計を確認できます</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {apps?.map((app) => (
                    <Card key={app.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/admin/stats/${app.id}`)}>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                            <div className="space-y-1">
                                <CardTitle className="text-xl">{app.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <Badge variant={app.status === 'ACTIVE' ? 'default' : 'secondary'}>{app.status}</Badge>
                                    <span className="text-xs">更新: {new Date(app.updatedAt).toLocaleDateString()}</span>
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" className="shrink-0">
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                <div className="flex flex-col items-center p-2 bg-muted/30 rounded-lg">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> 総件数</span>
                                    <span className="text-xl font-bold">{app.stats.totalCount}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                                    <span className="text-xs flex items-center gap-1 opacity-80"><Activity className="h-3 w-3" /> 稼働中</span>
                                    <span className="text-xl font-bold">{app.stats.activeCount}</span>
                                </div>
                                <div className="flex flex-col items-center p-2 bg-green-50 text-green-700 rounded-lg border border-green-100">
                                    <span className="text-xs flex items-center gap-1 opacity-80"><CheckCircle className="h-3 w-3" /> 完了</span>
                                    <span className="text-xl font-bold">{app.stats.approvedCount}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {apps?.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        アプリケーションが見つかりません
                    </div>
                )}
            </div>
        </div>
    );
}
