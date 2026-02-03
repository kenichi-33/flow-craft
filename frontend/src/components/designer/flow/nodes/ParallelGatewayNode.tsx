// ParallelGatewayNode - Converted from MUI to shadcn/ui
import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Split } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ParallelGatewayNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '分岐');
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) return;
        setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label, mode: 'split' } } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div className="relative">
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-yellow-600 border-white hover:bg-yellow-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <div
                    className={`w-[50px] h-[50px] rotate-45 flex items-center justify-center shadow-lg border-2 cursor-pointer transition-all duration-300
                        ${data.isFailed ? 'bg-red-200 border-red-500' : 
                          data.isCurrent ? 'bg-yellow-100 border-yellow-600 ring-4 ring-yellow-400/30' : 
                          data.isCompleted ? 'bg-emerald-200 border-emerald-500' :
                          'bg-yellow-300 border-yellow-500'}
                    `}
                    onDoubleClick={() => setDialogOpen(true)}
                >
                    <div className="-rotate-45"><Split className="h-7 w-7 text-yellow-700" /></div>
                    <Handle 
                        type="target" 
                        position={Position.Left} 
                        id="input" 
                        isConnectableStart={false}
                        className="!bg-white !border-2 !border-yellow-500 !w-2 !h-2 !left-0 !top-0 !-translate-x-1/2 !-translate-y-1/2 !rounded-none" 
                    />
                    <Handle 
                        type="source" 
                        position={Position.Right} 
                        id="output" 
                        className="!bg-yellow-500 !w-2 !h-2 !right-0 !bottom-0 !translate-x-1/2 !translate-y-1/2 !rounded-full" 
                    />
                </div>
                <span className="absolute top-14 left-1/2 -translate-x-1/2 w-24 text-center text-xs font-bold drop-shadow-sm pointer-events-none">{data.label || '分岐'}</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>{isReadOnly ? '並行分岐 (読取専用)' : '並行分岐の設定'}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>ラベル</Label>
                            <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} />
                            <p className="text-xs text-muted-foreground">全ての後続タスクを並行して生成します</p>
                        </div>
                    </div>
                    <DialogFooter>
                        {isReadOnly ? <Button onClick={() => setDialogOpen(false)}>閉じる</Button> : (
                            <><Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button><Button onClick={handleSave}>保存</Button></>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
