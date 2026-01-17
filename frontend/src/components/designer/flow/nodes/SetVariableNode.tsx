import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Variable, Plus, Trash2, Pencil } from 'lucide-react';
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

const SetVariableNode = ({ data }: any) => {
    const [open, setOpen] = React.useState(false);
    const [variables, setVariables] = React.useState<VariableItem[]>(data.variables || []);

    const handleSave = () => {
        data.variables = variables;
        // Map to updates for compatible processor logic if we reuse UpdateRecordProcessor?
        // Or specific processor.
        // Let's assume we use a specific processor or mapping.
        data.updates = variables; // Compatibility hack if using same processor logic structure
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
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-indigo-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Variable className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">変数設定</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1">
                    {variables.length} 変数
                </div>
                <Handle type="source" position={Position.Right} className="!bg-indigo-800 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>変数設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-2">
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
