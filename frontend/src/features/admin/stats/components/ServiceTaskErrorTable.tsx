import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ErrorStat {
  stepId: string;
  stepName: string;
  totalCount: number;
  failedCount: number;
  errorRate: number;
}

interface ServiceTaskErrorTableProps {
  data: ErrorStat[];
}

export const ServiceTaskErrorTable = ({ data }: ServiceTaskErrorTableProps) => {
  if (!data || data.length === 0) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <CardHeader className="absolute top-0 left-0 w-full">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            サービスタスク エラー率
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-muted-foreground">データがありません</div>
        </CardContent>
      </Card>
    );
  }

  // エラー率が高い順にソート
  const sortedData = [...data].sort((a, b) => b.errorRate - a.errorRate);

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex-none">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          サービスタスク エラー率
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タスク名</TableHead>
                <TableHead className="text-right">実行総数</TableHead>
                <TableHead className="text-right">失敗数</TableHead>
                <TableHead className="text-right">エラー率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((stat) => (
                <TableRow key={stat.stepId}>
                  <TableCell className="font-medium">
                    {stat.stepName}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {stat.totalCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive">
                    {stat.failedCount}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <Badge variant={stat.errorRate > 0 ? "destructive" : "outline"} className={stat.errorRate === 0 ? "text-muted-foreground" : ""}>
                        {stat.errorRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
};
