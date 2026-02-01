import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { UserDisplay } from '@/components/common/UserDisplay';

interface AssigneeStat {
  assignedTo: string;
  assignedToInfo?: any;
  stepId: string;
  stepName: string;
  taskCount: number;
  avgSeconds: number;
}

interface AssigneeStatsTableProps {
  data: AssigneeStat[];
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

export const AssigneeStatsTable = ({ data }: AssigneeStatsTableProps) => {
  if (!data || data.length === 0) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardHeader className="absolute top-0 left-0 w-full">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            担当者別パフォーマンス
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-muted-foreground">データがありません</div>
        </CardContent>
      </Card>
    );
  }

  // タスク数が多い順にソート
  const sortedData = [...data].sort((a, b) => b.taskCount - a.taskCount);

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex-none">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          担当者別パフォーマンス
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>担当者</TableHead>
                <TableHead>タスク名</TableHead>
                <TableHead className="text-right">処理タスク数</TableHead>
                <TableHead className="text-right">平均処理時間</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((stat) => (
                <TableRow key={`${stat.assignedTo}-${stat.stepId}`}>
                  <TableCell>
                    <UserDisplay user={stat.assignedToInfo} fallback={stat.assignedTo} />
                  </TableCell>
                  <TableCell>
                    {stat.stepName}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {stat.taskCount}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDuration(stat.avgSeconds)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
};
