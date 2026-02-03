// EndNode - Converted from MUI to Tailwind
import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

export default function EndNode({ id, data }: { id: string, data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [status, setStatus] = useState<string>(data.status || 'APPROVED');
    const [message, setMessage] = useState<string>(data.message || '申請が完了しました');
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            setStatus(data.status || 'APPROVED');
            setMessage(data.message || '申請が完了しました');
        }
    }, [dialogOpen, data.status, data.message]);

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: { ...node.data, status, message },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    return (
        <>
            <div 
                className={`w-[60px] h-[60px] rounded-full flex flex-col items-center justify-center shadow-lg border-[3px] relative group transition-all duration-300
                    ${data.isCompleted ? 'bg-gradient-to-br from-red-400 to-red-700 border-emerald-400 ring-4 ring-emerald-400/30' : 
                      data.isCurrent ? 'bg-gradient-to-br from-red-400 to-red-700 border-yellow-400 ring-4 ring-yellow-400/30' :
                      'bg-gradient-to-br from-red-400 to-red-700 border-white'}
                `}
                style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                onClick={isReadOnly ? undefined : () => setDialogOpen(true)}
            >
                {data.isCompleted && <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                 <span className="text-xs text-white font-bold drop-shadow-sm select-none">
                    {data.label || '終了'}
                </span>
                {!isReadOnly && (
                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="bg-white rounded-full p-1 shadow-sm border">
                            <Pencil className="h-3 w-3 text-gray-500" />
                        </div>
                    </div>
                )}
                <Handle
                    type="target"
                    position={Position.Left}
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-red-700 !w-2.5 !h-2.5 !rounded-none"
                />
                {data.statCount?.breakdown?.completed > 0 && (
                     <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-slate-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow border border-white whitespace-nowrap z-20">
                        完了: {data.statCount.breakdown.completed}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                 <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>終了イベントの設定</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>完了ステータス</Label>
                             <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="ステータスを選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="APPROVED">承認完了 (APPROVED)</SelectItem>
                                    <SelectItem value="REJECTED">却下 (REJECTED)</SelectItem>
                                    <SelectItem value="COMPLETED">完了 (COMPLETED)</SelectItem>
                                    <SelectItem value="CANCELLED">キャンセル (CANCELLED)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">フロー終了時のアプリケーションステータス。</p>
                        </div>
                        <div className="space-y-2">
                             <Label>完了メッセージ</Label>
                            <Input 
                                value={message} 
                                onChange={(e) => setMessage(e.target.value)} 
                                placeholder="申請が完了しました" 
                            />
                             <p className="text-xs text-muted-foreground">履歴に記録されるメッセージ。</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                         <Button onClick={handleSave}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
