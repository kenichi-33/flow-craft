import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Workflow, Pencil } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

// Mock hook or props for fetching definitions. 
// Ideally should use a query hook.
// For now, we will just use a text input for ID or simple placeholder.

const SubProcessNode = ({ id, data }: any) => {
    const { updateNodeData } = useReactFlow();
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState({
        label: data.label || '',
        applicationDefinitionId: data.applicationDefinitionId || '',
        passAllInput: data.passAllInput ?? true,
        waitForCompletion: data.waitForCompletion ?? true,
        // Mapping UI is complex, skipping for V1 basic UI unless requested.
        // We'll add a JSON text area for mapping for now for power users.
        inputMappingJSON: JSON.stringify(data.inputMapping || {}, null, 2),
    });

    const handleSave = () => {
        let inputMapping = {};
        try {
            inputMapping = JSON.parse(config.inputMappingJSON);
        } catch (e) {
            // ignore or alert
            console.error("Invalid JSON mapping");
        }

        updateNodeData(id, {
            ...data,
            label: config.label,
            applicationDefinitionId: config.applicationDefinitionId,
            passAllInput: config.passAllInput,
            waitForCompletion: config.waitForCompletion,
            inputMapping: inputMapping
        });
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className={`min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg flex flex-col items-center justify-center shadow-lg border-2 relative transition-all duration-300
                    ${data.isFailed ? 'bg-red-50 to-red-100 border-red-500 shadow-red-200' : 
                      data.isCurrent ? 'bg-gradient-to-br from-teal-500 to-teal-700 border-yellow-400 ring-4 ring-yellow-400/30' : 
                      'bg-gradient-to-br from-teal-500 to-teal-700 border-white/50'}
                `}
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-teal-600 border-white hover:bg-teal-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-teal-800 !w-2.5 !h-2.5 !rounded-none" 
                />
                <div className="flex items-center gap-1">
                    <Workflow className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{config.label || 'サブプロセス'}</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1">
                    {config.applicationDefinitionId ? '設定済み' : '未設定'}
                </div>
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="!bg-teal-800 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full" 
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
                        <DialogTitle>サブプロセス設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                             <Label htmlFor="label">ステップ名</Label>
                             <Input 
                                 id="label" 
                                 value={config.label} 
                                 onChange={(e) => setConfig({...config, label: e.target.value})}
                                 placeholder="サブプロセス"
                                 disabled={readOnly}
                             />
                        </div>

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

                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="waitForCompletion" 
                                checked={config.waitForCompletion}
                                onCheckedChange={(c) => setConfig({...config, waitForCompletion: !!c})}
                                disabled={readOnly}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="waitForCompletion">完了を待つ (同期実行)</Label>
                                <p className="text-[0.8rem] text-muted-foreground">
                                    OFFの場合、サブプロセスを開始した直後に次のノードへ進みます (非同期)。
                                </p>
                            </div>
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
