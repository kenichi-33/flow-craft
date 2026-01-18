import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Database, Plus, Trash2, Pencil } from 'lucide-react';
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

interface UpdateItem {
    key: string;
    value: string;
}

const UpdateRecordNode = ({ data }: any) => {
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState({
        label: data.label || '',
    });
    const [updates, setUpdates] = React.useState<UpdateItem[]>(data.updates || []);
    
    // Sync label from data if needed, but simple init is usually enough for these nodes unless data changes externally

    const handleSave = () => {
        data.label = config.label;
        data.updates = updates;
        setOpen(false);
    };

    const addUpdate = () => {
        setUpdates([...updates, { key: '', value: '' }]);
    };

    const removeUpdate = (index: number) => {
        setUpdates(updates.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: 'key' | 'value', val: string) => {
        const newUpdates = [...updates];
        newUpdates[index] = { ...newUpdates[index], [field]: val };
        setUpdates(newUpdates);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-orange-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Database className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{config.label || 'レコード更新'}</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1">
                     {updates.length} 件の更新
                </div>
                <Handle type="source" position={Position.Right} className="!bg-orange-800 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>データ更新設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-2 space-y-4">
                        <div className="grid gap-2">
                             <Label htmlFor="label">ステップ名</Label>
                             <Input 
                                 id="label" 
                                 value={config.label} 
                                 onChange={(e) => setConfig({...config, label: e.target.value})}
                                 placeholder="レコード更新"
                                 disabled={readOnly}
                             />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <Label>更新するフィールド</Label>
                                {!readOnly && (
                                <Button size="sm" variant="outline" onClick={addUpdate}>
                                    <Plus className="h-3 w-3 mr-1" /> 追加
                                </Button>
                                )}
                            </div>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {updates.length === 0 && <div className="text-sm text-muted-foreground p-2 text-center">設定なし</div>}
                                {updates.map((item, index) => (
                                    <div key={index} className="flex gap-2 items-center">
                                        <div className="grid gap-1 flex-1">
                                            <Input 
                                                placeholder="キー (例: status)" 
                                                value={item.key} 
                                                onChange={(e) => updateItem(index, 'key', e.target.value)} 
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div className="grid gap-1 flex-1">
                                            <Input 
                                                placeholder="値 (例: approved)" 
                                                value={item.value} 
                                                onChange={(e) => updateItem(index, 'value', e.target.value)} 
                                                disabled={readOnly}
                                            />
                                        </div>
                                        {!readOnly && (
                                        <Button variant="ghost" size="icon" onClick={() => removeUpdate(index)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                                * `{'{{key}}'}` 形式で変数を参照できます。
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

export default memo(UpdateRecordNode);
