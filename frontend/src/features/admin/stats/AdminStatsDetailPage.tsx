import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2 } from 'lucide-react';
import FlowDesigner from '@/components/designer/flow/FlowDesigner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { PerformanceTraceTable } from './components/PerformanceTraceGraph';
import { ApplicationRatesChart } from './components/ApplicationRatesChart';
import { AssigneeStatsTable } from './components/AssigneeStatsTable';
import { ServiceTaskErrorTable } from './components/ServiceTaskErrorTable';

interface NodeStat {
    nodeId: string;
    count: number;
    breakdown?: {
        active?: number;
        draft?: number;
        completed?: number;
        assigned?: number;
        unassigned?: number;
    };
}

interface DailyStat {
    date: string; // YYYY-MM-DD
    count: number;
}

interface StatusStat {
    status: string;
    count: number;
}

interface AppStatsDetail {
    definition: any;
    statusDistribution: StatusStat[];
    nodeDistribution: NodeStat[];
    dailyStats: DailyStat[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const STATUS_LABELS: Record<string, string> = {
    DRAFT: '下書き',
    IN_PROGRESS: '進行中',
    APPROVED: '完了',
    REJECTED: '却下',
    REMANDED: '差戻し',
    CANCELED: '取下げ',
};

export default function AdminStatsDetailPage() {
    const { id } = useParams();
    
    const { data: stats, isLoading, error } = useQuery<AppStatsDetail>({
        queryKey: ['admin-stats-detail', id],
        queryFn: () => api.get(`/statistics/applications/${id}`),
        enabled: !!id
    });

    const { data: performanceData, isLoading: isPerformanceLoading } = useQuery({
        queryKey: ['admin-stats-performance', id],
        queryFn: () => api.get<any[]>(`/statistics/applications/${id}/performance`),
        enabled: !!id
    });

    const { data: ratesData, isLoading: isRatesLoading } = useQuery({
        queryKey: ['admin-stats-rates', id],
        queryFn: () => api.get<any>(`/statistics/applications/${id}/rates`),
        enabled: !!id
    });

    const { data: assigneeData, isLoading: isAssigneeLoading } = useQuery({
        queryKey: ['admin-stats-assignees', id],
        queryFn: () => api.get<any[]>(`/statistics/applications/${id}/assignees`),
        enabled: !!id
    });

    const { data: errorData, isLoading: isErrorLoading } = useQuery({
        queryKey: ['admin-stats-errors', id],
        queryFn: () => api.get<any[]>(`/statistics/applications/${id}/errors`),
        enabled: !!id
    });

    const totalCount = useMemo(() => stats?.statusDistribution.reduce((acc, cur) => acc + cur.count, 0) || 0, [stats]);

    const flowOverlay = useMemo(() => {
        if (!stats?.nodeDistribution) return null;
        const overlay: Record<string, any> = {};
        stats.nodeDistribution.forEach(n => {
            overlay[n.nodeId] = { count: n.count, breakdown: n.breakdown };
        });
        return overlay;
    }, [stats]);

    const statusData = useMemo(() => {
        if (!stats?.statusDistribution) return [];
        return stats.statusDistribution.map(item => ({
            ...item,
            name: `${STATUS_LABELS[item.status] || item.status} (${totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : 0}%)`
        }));
    }, [stats, totalCount]);

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error || !stats) return <div className="p-8 text-destructive">統計データの読み込みに失敗しました</div>;

    const app = stats.definition;

    return (
        <div className="space-y-6 p-6 pb-20">
            <div className="flex items-center gap-4 px-1 shrink-0">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/admin/stats"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{app.name} 統計</h2>
                    <p className="text-sm text-muted-foreground">Version {app.version} - Status: {STATUS_LABELS[app.status] || app.status}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                 {/* ステータス分布 */}
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">ステータス分布</CardTitle></CardHeader>
                    <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={65}
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="name"
                                >
                                    {statusData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                                    <tspan x="50%" dy="-0.4em" fontSize="20" fontWeight="bold" fill="currentColor" className="fill-foreground">{totalCount}</tspan>
                                    <tspan x="50%" dy="1.6em" fontSize="10" fill="currentColor" className="fill-muted-foreground">合計</tspan>
                                </text>
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 日次推移 */}
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">日次申請数 (過去30日)</CardTitle></CardHeader>
                    <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.dailyStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tickFormatter={(str) => str.slice(5)} />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8884d8" name="申請数" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Application Rates */}
            {isRatesLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : ratesData ? (
                <ApplicationRatesChart data={ratesData} />
            ) : null}

            {/* Performance Trace & Statistics */}
            <div className="space-y-6">
                {/* Performance Trace (Full Width) */}
                <div>
                    {isPerformanceLoading ? (
                         <Card className="h-[500px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Card>
                    ) : (
                        <PerformanceTraceTable data={performanceData || []} />
                    )}
                </div>

                {/* Assignees & Errors (Half/Half) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                         {isAssigneeLoading ? (
                             <Card className="h-[500px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Card>
                         ) : (
                            <AssigneeStatsTable data={assigneeData || []} />
                         )}
                    </div>
                    <div>
                         {isErrorLoading ? (
                             <Card className="h-[500px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Card>
                         ) : (
                            <ServiceTaskErrorTable data={errorData || []} />
                         )}
                    </div>
                </div>
            </div>

            <Card className="flex flex-col h-[600px] border-2 border-primary/20 bg-accent/5">
                <CardHeader className="border-b bg-background py-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>フロー滞留ヒートマップ</CardTitle>
                        <Badge variant="outline" className="bg-background">赤色バッジ = 滞留件数</Badge>
                    </div>
                </CardHeader>
                <div className="flex-1 relative">
                    {/* ここで FlowDesigner を ReadOnly で表示し、各ノードにバッジを表示する仕組みが必要 */}
                    {/* FlowDesigner に `statsOverlay` プロップを追加して対応する */}
                    <FlowDesigner appId={app.id} isStatsMode={true} statsOverlay={flowOverlay || {}} />
                </div>
            </Card>
        </div>
    );
}
