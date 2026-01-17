// BranchNode - Converted from MUI to shadcn/ui
import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Pencil, Plus, Trash2 } from 'lucide-react';

interface Condition {
    field: string;
    operator: string;
    value: string;
}

export default function BranchNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    
    // Legacy single condition support (will be migrated to list on save if list is used)
    const [conditions, setConditions] = useState<Condition[]>(data.conditions || [
        { field: data.conditionField || '', operator: data.conditionOperator || '==', value: data.conditionValue || '' }
    ]);
    const [conditionLogic, setConditionLogic] = useState<'and' | 'or'>(data.conditionLogic || 'and');

    const [yesLabel, setYesLabel] = useState(data.yesLabel || 'はい');
    const [noLabel, setNoLabel] = useState(data.noLabel || 'いいえ');
    const { setNodes } = useReactFlow();

    const isReadOnly = data.readOnly === true;
    const formFields = data.formFields || [];

    useEffect(() => {
        if (dialogOpen) {
             setConditions(data.conditions || [
                { field: data.conditionField || '', operator: data.conditionOperator || '==', value: data.conditionValue || '' }
            ]);
            setConditionLogic(data.conditionLogic || 'and');
        }
    }, [dialogOpen, data]);

    const handleSave = () => {
        if (isReadOnly) return;
        
        // Use the first condition for legacy compatibility if needed, or just save the full list
        // We will prioritize 'conditions' in the processor
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { 
                        ...node, 
                        data: { 
                            ...node.data, 
                            conditions, 
                            conditionLogic,
                            // Legacy sync
                            conditionField: conditions[0]?.field,
                            conditionOperator: conditions[0]?.operator,
                            conditionValue: conditions[0]?.value,
                            yesLabel, 
                            noLabel 
                        } 
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const addCondition = () => {
        setConditions([...conditions, { field: '', operator: '==', value: '' }]);
    };

    const removeCondition = (index: number) => {
        const newConditions = conditions.filter((_, i) => i !== index);
        setConditions(newConditions.length ? newConditions : [{ field: '', operator: '==', value: '' }]);
    };

    const updateCondition = (index: number, key: keyof Condition, val: string) => {
        const newConditions = [...conditions];
        newConditions[index] = { ...newConditions[index], [key]: val };
        setConditions(newConditions);
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none text-center">
                    <span className="text-[10px] text-white font-bold drop-shadow-md block leading-none">
                        {conditions.length > 1 ? `${conditions.length}条件` : (conditions[0]?.field ? getOperatorLabel(conditions[0].operator) : '?')}
                    </span>
                    {conditions.length > 1 && <span className="text-[8px] text-white/90">{conditionLogic === 'and' ? 'AND' : 'OR'}</span>}
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
                <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-[9px] font-bold text-green-500">{yesLabel || 'はい'}</span>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-500">{noLabel || 'いいえ'}</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{isReadOnly ? '分岐条件 (読取専用)' : '分岐条件の設定'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="flex items-center gap-4">
                            <Label>条件ロジック:</Label>
                            <RadioGroup 
                                value={conditionLogic} 
                                onValueChange={(v) => setConditionLogic(v as 'and' | 'or')} 
                                className="flex gap-4"
                                disabled={isReadOnly}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="and" id="logic-and" />
                                    <Label htmlFor="logic-and">すべて一致 (AND)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="or" id="logic-or" />
                                    <Label htmlFor="logic-or">いずれか一致 (OR)</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                            {conditions.map((cond, index) => (
                                <div key={index} className="flex gap-2 items-end p-2 border rounded-md bg-muted/20">
                                    <div className="grid gap-1.5 flex-1 min-w-[120px]">
                                        <Label className="text-xs">フィールド</Label>
                                        <Select value={cond.field} onValueChange={(v) => updateCondition(index, 'field', v)} disabled={isReadOnly}>
                                            <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                                            <SelectContent>
                                                {formFields.map((field: any) => (
                                                    <SelectItem key={field.id} value={field.id}>{field.label || field.id}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5 w-[100px]">
                                        <Label className="text-xs">演算子</Label>
                                        <Select value={cond.operator} onValueChange={(v) => updateCondition(index, 'operator', v)} disabled={isReadOnly}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="==">=</SelectItem>
                                                <SelectItem value="!=">≠</SelectItem>
                                                <SelectItem value=">">&gt;</SelectItem>
                                                <SelectItem value="<">&lt;</SelectItem>
                                                <SelectItem value=">=">≥</SelectItem>
                                                <SelectItem value="<=">≤</SelectItem>
                                                <SelectItem value="contains">含む</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5 flex-1">
                                        <Label className="text-xs">値</Label>
                                        <Input value={cond.value} onChange={(e) => updateCondition(index, 'value', e.target.value)} disabled={isReadOnly} />
                                    </div>
                                    {!isReadOnly && (
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeCondition(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <Button variant="outline" size="sm" onClick={addCondition} className="w-full border-dashed">
                                    <Plus className="h-4 w-4 mr-2" /> 条件を追加
                                </Button>
                            )}
                        </div>

                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-green-600 font-bold">条件一致時の移動先 (右)</Label>
                                <Input value={yesLabel} onChange={(e) => setYesLabel(e.target.value)} disabled={isReadOnly} />
                                <p className="text-xs text-muted-foreground">全ての条件(AND) または いずれか(OR) が満たされた場合</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-red-600 font-bold">不一致時の移動先 (下)</Label>
                                <Input value={noLabel} onChange={(e) => setNoLabel(e.target.value)} disabled={isReadOnly} />
                                <p className="text-xs text-muted-foreground">それ以外の場合 (デフォルト)</p>
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
