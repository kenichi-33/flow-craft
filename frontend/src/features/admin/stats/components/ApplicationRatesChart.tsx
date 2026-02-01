import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, FileX, XCircle } from 'lucide-react';

interface RatesData {
  approvalRate: number;
  rejectionRate: number;
  withdrawalRate: number;
  remandRate: number;
  counts: {
    approved: number;
    rejected: number;
    canceled: number;
    remanded: number;
    total: number;
  };
}

interface ApplicationRatesChartProps {
  data: RatesData;
}

export const ApplicationRatesChart = ({ data }: ApplicationRatesChartProps) => {
  const approvalRate = data.approvalRate ?? 0;
  const rejectionRate = data.rejectionRate ?? 0;
  const withdrawalRate = data.withdrawalRate ?? 0;
  const remandRate = data.remandRate ?? 0;
  const counts = data.counts || { approved: 0, rejected: 0, canceled: 0, remanded: 0, total: 0 };

  const pieData = [
    { name: '承認', value: counts.approved, color: '#22c55e' }, // green-500
    { name: '却下', value: counts.rejected, color: '#ef4444' }, // red-500
    { name: '取下げ', value: counts.canceled, color: '#64748b' }, // slate-500
    // REMANDEDは状態遷移の一部なので円グラフの「結果」には含めにくいが、現状のステータス分布ではないので注意
    // ここでは完了したものの内訳を表示する
  ].filter((d) => d.value > 0);

  const totalCompleted = counts.approved + counts.rejected + counts.canceled;


  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 完了結果の内訳（円グラフ） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">完了案件の内訳</CardTitle>
        </CardHeader>
        <CardContent>
            {totalCompleted === 0 ? (
                 <div className="h-[200px] flex items-center justify-center text-muted-foreground">データがありません</div>
            ) : (
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        >
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="middle" align="right" layout="vertical" />
                    </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
        </CardContent>
      </Card>

      {/* 各種レート（プログレスバー） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">各種パフォーマンス指標</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* 承認完了率 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>承認完了率</span>
              </div>
              <span className="font-bold">{approvalRate.toFixed(1)}%</span>
            </div>
            <Progress value={approvalRate} className="h-2 bg-muted [&>*]:bg-green-500" />
            <p className="text-xs text-muted-foreground text-right">
                {counts.approved} / {totalCompleted} 件
            </p>
          </div>

          {/* 却下率 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span>却下率</span>
              </div>
              <span className="font-bold">{rejectionRate.toFixed(1)}%</span>
            </div>
            <Progress value={rejectionRate} className="h-2 bg-muted [&>*]:bg-red-500" />
            <p className="text-xs text-muted-foreground text-right">
                {counts.rejected} / {totalCompleted} 件
            </p>
          </div>

          {/* 取下げ率 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1">
                <FileX className="w-4 h-4 text-slate-500" />
                <span>取下げ率</span>
              </div>
              <span className="font-bold">{withdrawalRate.toFixed(1)}%</span>
            </div>
            <Progress value={withdrawalRate} className="h-2 bg-muted [&>*]:bg-slate-500" />
            <p className="text-xs text-muted-foreground text-right">
                {counts.canceled} / {totalCompleted} 件
            </p>
          </div>

          {/* 差戻しの発生率 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span>差戻し発生率</span>
              </div>
              <span className="font-bold">{remandRate.toFixed(1)}%</span>
            </div>
            <Progress value={remandRate} className="h-2 bg-muted [&>*]:bg-orange-500" />
            <p className="text-xs text-muted-foreground text-right">
                {counts.remanded} / {counts.total} 件中
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
