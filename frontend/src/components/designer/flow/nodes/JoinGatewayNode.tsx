// JoinGatewayNode - Converted from MUI to shadcn/ui
import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export default function JoinGatewayNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '合流');
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) return;
        setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label } } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div className="relative">
                <div
                    className="w-[50px] h-[50px] rotate-45 bg-yellow-300 flex items-center justify-center shadow-lg border-2 border-yellow-500 cursor-pointer"
                    onDoubleClick={() => setDialogOpen(true)}
                >
                    <div className="-rotate-45"><Plus className="h-8 w-8 text-yellow-700" /></div>
                    <Handle type="target" position={Position.Left} id="input" className="!bg-yellow-500 !w-2 !h-2 !left-0 !top-0 !-translate-x-1/2 !-translate-y-1/2" />
                    <Handle type="source" position={Position.Right} id="output" className="!bg-yellow-500 !w-2 !h-2 !right-0 !bottom-0 !translate-x-1/2 !translate-y-1/2" />
                </div>
                <span className="absolute top-14 left-1/2 -translate-x-1/2 w-24 text-center text-xs font-bold drop-shadow-sm pointer-events-none">{data.label || '合流'}</span>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>{isReadOnly ? '合流ゲートウェイ (読取専用)' : '合流ゲートウェイ設定'}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>ラベル</Label>
                            <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} />
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
