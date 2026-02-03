import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Variable, Plus, Trash2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface VariableItem {
    key: string;
    value: string;
}

const SetVariableNode = ({ id, data }: any) => {
    const { updateNodeData } = useReactFlow();
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState({
        label: data.label || '',
    });
    const [variables, setVariables] = React.useState<VariableItem[]>(data.variables || []);

    const handleSave = () => {
        updateNodeData(id, {
            ...data,
            label: config.label,
            variables: variables,
            updates: variables
        });
        setOpen(false);
    };

    const addVariable = () => {
        setVariables([...variables, { key: '', value: '' }]);
    };

    const removeVariable = (index: number) => {
        setVariables(variables.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: 'key' | 'value', val: string) => {
        const newVars = [...variables];
        newVars[index] = { ...newVars[index], [field]: val };
        setVariables(newVars);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className={`min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg flex flex-col items-center justify-center shadow-lg border-2 relative transition-all duration-300
                    ${data.isFailed ? 'bg-red-50 to-red-100 border-red-500 shadow-red-200' : 
                      data.isCurrent ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 border-yellow-400 ring-4 ring-yellow-400/30' : 
                      'bg-gradient-to-br from-indigo-500 to-indigo-700 border-white/50'}
                `}
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-indigo-600 border-white hover:bg-indigo-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-indigo-800 !w-2.5 !h-2.5 !rounded-none" 
                />
                <div className="flex items-center gap-1">
                    <Variable className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{config.label || '変数設定'}</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1">
                    {variables.length} 変数
                </div>
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="!bg-indigo-800 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full" 
                />
                {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>変数設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-2 space-y-4">
                        <div className="grid gap-2">
                             <Label htmlFor="label">ステップ名</Label>
                             <Input 
                                 id="label" 
                                 value={config.label} 
                                 onChange={(e) => setConfig({...config, label: e.target.value})}
                                 placeholder="変数設定"
                                 disabled={readOnly}
                             />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <Label>設定する変数</Label>
                                {!readOnly && (
                                <Button size="sm" variant="outline" onClick={addVariable}>
                                    <Plus className="h-3 w-3 mr-1" /> 追加
                                </Button>
                                )}
                            </div>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {variables.length === 0 && <div className="text-sm text-muted-foreground p-2 text-center">設定なし</div>}
                                {variables.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <div className="grid gap-1 flex-1">
                                            <Input 
                                                placeholder="変数名 (例: discount)" 
                                                value={item.key} 
                                                onChange={(e) => updateItem(index, 'key', e.target.value)} 
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div className="grid gap-1 flex-1">
                                            <Input 
                                                placeholder="値 (例: 0.1 または {{input.rate}})" 
                                                value={item.value} 
                                                onChange={(e) => updateItem(index, 'value', e.target.value)} 
                                                disabled={readOnly}
                                            />
                                        </div>
                                        {!readOnly && (
                                        <Button variant="ghost" size="icon" onClick={() => removeVariable(index)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                * `{'{{key}}'}` 形式で他の変数を参照できます。
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>閉じる</Button>
                        {!readOnly && <Button onClick={handleSave}>保存</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default memo(SetVariableNode);
