import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LabelList
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Task {
    id: string;
    stepId: string;
    type: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    error?: string;
}

interface TimelineEntry {
    name: string;
    originalId: string;
    type: string;
    status: string;
    offset: number;
    duration: number;
    startStr: string;
    endStr: string;
    durationStr: string;
    fullTask: Task | null;
    isTotal: boolean;
}

interface PerformanceTimelineProps {
    tasks: Task[];
    flowNodes?: { id: string, data?: { label?: string, title?: string } }[];
}


export const PerformanceTimeline: React.FC<PerformanceTimelineProps> = ({ tasks, flowNodes }) => {
    const data: TimelineEntry[] = useMemo(() => {
        if (!tasks || tasks.length === 0) return [];
        
        // Helper for dynamic duration formatting
        const formatDuration = (ms: number) => {
            if (ms < 1000) return `${ms}ms`;
            if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
            if (ms < 3600000) { // < 1 hour
                const mins = Math.floor(ms / 60000);
                const secs = Math.floor((ms % 60000) / 1000);
                return `${mins}m${secs}s`;
            }
            if (ms < 86400000) { // < 24 hours
                const hours = Math.floor(ms / 3600000);
                const mins = Math.floor((ms % 3600000) / 60000);
                return `${hours}h${mins}m`;
            }
            const days = Math.floor(ms / 86400000);
            const hours = Math.floor((ms % 86400000) / 3600000);
            return `${days}d${hours}h`;
        };
        
        // Sort by creation time ascending for timeline
        const sortedTasks = [...tasks].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const minTime = new Date(sortedTasks[0].createdAt).getTime();
        // Calculate max time based on latest update or current time if active
        let maxTime = minTime;
        sortedTasks.forEach(t => {
            const end = t.status === 'PENDING' || t.status === 'RUNNING' || t.status === 'QUEUED' 
                ? new Date().getTime() 
                : (t.updatedAt ? new Date(t.updatedAt).getTime() : new Date().getTime());
            if (end > maxTime) maxTime = end;
        });

        // 1. Create Task Rows
        const rows = sortedTasks.map(task => {
            const start = new Date(task.createdAt).getTime();
            const end = task.status === 'PENDING' || task.status === 'RUNNING' || task.status === 'QUEUED' 
                ? new Date().getTime() 
                : (task.updatedAt ? new Date(task.updatedAt).getTime() : new Date().getTime());
            
            const durationMs = end - start;
            
            // Resolve Step Label
            const node = flowNodes?.find(n => n.id === task.stepId);
            const label = node?.data?.label || node?.data?.title || task.stepId;

            return {
                name: label,
                originalId: task.stepId,
                type: task.type,
                status: task.status,
                offset: start - minTime,
                duration: durationMs,
                startStr: new Date(start).toLocaleString('ja-JP'),
                endStr: task.status === 'PENDING' ? '進行中' : new Date(end).toLocaleString('ja-JP'),
                durationStr: formatDuration(durationMs),
                fullTask: task,
                isTotal: false
            };
        });

        // 2. Add Total Row at the top
        const totalDuration = maxTime - minTime;
        const totalRow = {
            name: '全体所要時間',
            originalId: 'TOTAL',
            type: 'summary',
            status: 'COMPLETED', // Use a neutral status or specific color
            offset: 0,
            duration: totalDuration,
            startStr: new Date(minTime).toLocaleString('ja-JP'),
            endStr: new Date(maxTime).toLocaleString('ja-JP'),
            durationStr: formatDuration(totalDuration),
            fullTask: null,
            isTotal: true
        };

        return [totalRow, ...rows];
    }, [tasks, flowNodes]);

    if (data.length === 0) return null;

    const getColor = (entry: TimelineEntry) => {
        if (entry.isTotal) return '#64748b'; // slate-500
        switch (entry.status) {
            case 'COMPLETED': return '#22c55e'; // green-500
            case 'FAILED': return '#ef4444'; // red-500
            case 'PENDING': 
            case 'RUNNING': return '#3b82f6'; // blue-500
            default: return '#94a3b8'; // slate-400
        }
    };

    return (
        <Card>
            <CardHeader className="py-4">
                <CardTitle className="text-base font-medium">パフォーマンストレース</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 20, right: 50, left: 0, bottom: 5 }}
                        >
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 12}} />
                            <Tooltip content={<CustomTooltip getColor={getColor} />} cursor={{fill: 'transparent'}} />
                            
                            {/* Spacer Bar (Invisible) */}
                            <Bar dataKey="offset" stackId="a" fill="transparent" />
                            
                            {/* Duration Bar */}
                            <Bar dataKey="duration" stackId="a" radius={[0, 4, 4, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={getColor(entry)} />
                                ))}
                                <LabelList dataKey="durationStr" position="right" style={{ fontSize: '11px', fill: '#64748b' }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: any[];
    getColor: (entry: TimelineEntry) => string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, getColor }) => {
    if (active && payload && payload.length) {
        // Payload[1] is the duration bar
        const item = payload[1]?.payload;
        if (!item) return null;
        
        return (
            <div className="rounded-lg border bg-background p-3 shadow-md text-xs min-w-[200px]">
                <div className="font-bold text-sm mb-2 border-b pb-1 flex items-center justify-between">
                    {item.name} 
                    {!item.isTotal && <Badge variant="outline" className="text-[10px] h-5 ml-2">{item.type}</Badge>}
                </div>
                <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex justify-between"><span>開始:</span> <span className="text-foreground font-mono">{item.startStr}</span></div>
                    <div className="flex justify-between"><span>終了:</span> <span className="text-foreground font-mono">{item.endStr}</span></div>
                    <div className="flex justify-between border-t border-dashed pt-1 mt-1">
                        <span>所要時間:</span> 
                        <span className="font-bold text-foreground text-sm">{item.durationStr}</span>
                    </div>
                    {!item.isTotal && (
                        <div className="flex justify-between">
                            <span>状態:</span> 
                            <span style={{ color: getColor(item), fontWeight: 'bold' }}>{item.status}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};


