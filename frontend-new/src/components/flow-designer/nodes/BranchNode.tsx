// BranchNode - Converted from MUI to shadcn/ui
import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Pencil } from 'lucide-react';

export default function BranchNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [conditionField, setConditionField] = useState(data.conditionField || '');
    const [conditionOperator, setConditionOperator] = useState<string>(data.conditionOperator || '==');
    const [conditionValue, setConditionValue] = useState(data.conditionValue || '');
    const [yesLabel, setYesLabel] = useState(data.yesLabel || 'はい');
    const [noLabel, setNoLabel] = useState(data.noLabel || 'いいえ');
    const { setNodes } = useReactFlow();

    const isReadOnly = data.readOnly === true;
    const formFields = data.formFields || [];

    const handleSave = () => {
        if (isReadOnly) return;
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, conditionField, conditionOperator, conditionValue, yesLabel, noLabel } }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const getOperatorLabel = (op: string) => {
        const labels: Record<string, string> = { '==': '=', '!=': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤', contains: '∋' };
        return labels[op] || op;
    };

    return (
        <>
            <div className="relative w-20 h-20">
                {/* Diamond shape */}
                <div
                    className="absolute w-14 h-14 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gradient-to-br from-orange-400 to-orange-600 rounded shadow-lg border-2 border-white/50 cursor-pointer"
                    onClick={() => setDialogOpen(true)}
                />
                {/* Content */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <span className="text-[10px] text-white font-bold drop-shadow-md">
                        {data.conditionField ? getOperatorLabel(data.conditionOperator || '==') : '?'}
                    </span>
                </div>
                {/* Edit button */}
                {!isReadOnly && (
                    <button className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center hover:bg-gray-100" onClick={() => setDialogOpen(true)}>
                        <Pencil className="w-3 h-3 text-gray-600" />
                    </button>
                )}
                {/* Handles */}
                <Handle type="target" position={Position.Left} className="!bg-orange-700 !w-2.5 !h-2.5 !border-2 !border-white !-left-1" />
                <Handle type="source" position={Position.Right} id="yes" className="!bg-green-500 !w-2.5 !h-2.5 !border-2 !border-white !-right-1" />
                <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-500 !w-2.5 !h-2.5 !border-2 !border-white !-bottom-1" />
                {/* Labels */}
                <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-[9px] font-bold text-green-500">{data.yesLabel || 'はい'}</span>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-500">{data.noLabel || 'いいえ'}</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isReadOnly ? '分岐条件 (読取専用)' : '分岐条件の設定'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-muted-foreground">フォームの値に基づいて分岐を設定します</p>
                        <div className="space-y-1.5">
                            <Label>条件フィールド</Label>
                            <Select value={conditionField} onValueChange={setConditionField} disabled={isReadOnly}>
                                <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                                <SelectContent>
                                    {formFields.map((field: any) => (
                                        <SelectItem key={field.id} value={field.id}>{field.label || field.id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label>演算子</Label>
                                <Select value={conditionOperator} onValueChange={setConditionOperator} disabled={isReadOnly}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="==">等しい (=)</SelectItem>
                                        <SelectItem value="!=">等しくない (≠)</SelectItem>
                                        <SelectItem value=">">より大きい (&gt;)</SelectItem>
                                        <SelectItem value="<">より小さい (&lt;)</SelectItem>
                                        <SelectItem value=">=">以上 (≥)</SelectItem>
                                        <SelectItem value="<=">以下 (≤)</SelectItem>
                                        <SelectItem value="contains">含む</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>比較値</Label>
                                <Input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)} placeholder="例: 100000" disabled={isReadOnly} />
                            </div>
                        </div>
                        <Separator />
                        <p className="text-sm font-medium">出力ラベル</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-green-600">条件一致時 (右)</Label>
                                <Input value={yesLabel} onChange={(e) => setYesLabel(e.target.value)} disabled={isReadOnly} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-red-600">条件不一致時 (下)</Label>
                                <Input value={noLabel} onChange={(e) => setNoLabel(e.target.value)} disabled={isReadOnly} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        {isReadOnly ? (
                            <Button onClick={() => setDialogOpen(false)}>閉じる</Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                                <Button onClick={handleSave}>保存</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
