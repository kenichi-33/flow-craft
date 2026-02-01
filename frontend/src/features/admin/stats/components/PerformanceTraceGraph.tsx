import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface TaskPerfStat {
  stepId: string;
  stepName: string;
  avgSeconds: number;
  minSeconds: number;
  maxSeconds: number;
  avgWaitSeconds: number;
  avgExecutionSeconds: number;
  count: number;
}

interface PerformanceTraceTableProps {
  data: TaskPerfStat[];
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

export const PerformanceTraceTable = ({ data }: PerformanceTraceTableProps) => {
  if (!data || data.length === 0) {
    return (
      <Card className="h-[500px] flex items-center justify-center text-muted-foreground">
        データがありません
      </Card>
    );
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex-none">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4" />
          タスク処理時間統計
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タスク名</TableHead>
              <TableHead className="text-right" title="完了したタスクの総数">件数</TableHead>
              <TableHead className="text-right" title="タスク作成から着手されるまでの平均時間">平均待機</TableHead>
              <TableHead className="text-right" title="着手から完了までの平均時間">平均処理</TableHead>
              <TableHead className="text-right" title="タスク作成から完了までの平均時間">平均合計</TableHead>
              <TableHead className="text-right">最小</TableHead>
              <TableHead className="text-right">最大</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((stat) => (
              <TableRow key={stat.stepId}>
                <TableCell className="font-medium">{stat.stepName}</TableCell>
                <TableCell className="text-right">{stat.count}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatDuration(stat.avgWaitSeconds)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatDuration(stat.avgExecutionSeconds)}</TableCell>
                <TableCell className="text-right font-bold">{formatDuration(stat.avgSeconds)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatDuration(stat.minSeconds)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatDuration(stat.maxSeconds)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
