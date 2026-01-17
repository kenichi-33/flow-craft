import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Workflow, Pencil } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

// Mock hook or props for fetching definitions. 
// Ideally should use a query hook.
// For now, we will just use a text input for ID or simple placeholder.

const SubProcessNode = ({ data }: any) => {
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState({
        applicationDefinitionId: data.applicationDefinitionId || '',
        passAllInput: data.passAllInput ?? true,
        // Mapping UI is complex, skipping for V1 basic UI unless requested.
        // We'll add a JSON text area for mapping for now for power users.
        inputMappingJSON: JSON.stringify(data.inputMapping || {}, null, 2),
    });

    const handleSave = () => {
        data.applicationDefinitionId = config.applicationDefinitionId;
        data.passAllInput = config.passAllInput;
        try {
            data.inputMapping = JSON.parse(config.inputMappingJSON);
        } catch (e) {
            // ignore or alert
            console.error("Invalid JSON mapping");
        }
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-teal-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Workflow className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">サブプロセス</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1">
                    {config.applicationDefinitionId ? '設定済み' : '未設定'}
                </div>
                <Handle type="source" position={Position.Right} className="!bg-teal-800 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>サブプロセス設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="appDefId">実行するアプリ定義ID</Label>
                            <Input 
                                id="appDefId" 
                                placeholder="UUID..."
                                value={config.applicationDefinitionId} 
                                onChange={(e) => setConfig({...config, applicationDefinitionId: e.target.value})} 
                                disabled={readOnly}
                            />
                            <p className="text-xs text-muted-foreground">※ 将来的にドロップダウン選択に対応予定</p>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="passAll" 
                                checked={config.passAllInput}
                                onCheckedChange={(c) => setConfig({...config, passAllInput: !!c})}
                                disabled={readOnly}
                            />
                            <Label htmlFor="passAll">親の入力データをすべて引き継ぐ</Label>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="mapping">入力マッピング (JSON)</Label>
                            <textarea
                                id="mapping"
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={config.inputMappingJSON}
                                onChange={(e) => setConfig({...config, inputMappingJSON: e.target.value})}
                                placeholder='{ "childField": "{{parentField}}" }'
                                disabled={readOnly}
                            />
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

export default memo(SubProcessNode);
