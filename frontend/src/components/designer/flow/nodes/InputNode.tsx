import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Keyboard, Pencil } from 'lucide-react';
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
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue 
} from '@/components/ui/select';

const InputNode = ({ data }: any) => {
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState({
        title: data.title || '追加情報の入力',
        description: data.description || '以下の情報を入力してください',
        assignedTo: data.assignedTo || 'applicant',
        // In future: Form Schema Selection
    });

    const handleSave = () => {
        data.title = config.title;
        data.description = config.description;
        data.assignedTo = config.assignedTo;
       
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
             <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: 'pointer' }}
                onClick={() => setOpen(true)}
            >
                <Handle type="target" position={Position.Left} className="!bg-sky-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Keyboard className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">入力タスク</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1 truncate max-w-[120px]">
                    {config.title}
                </div>
                <Handle type="source" position={Position.Right} className="!bg-sky-800 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>
            
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>入力タスク設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">タスク名</Label>
                            <Input 
                                id="title" 
                                value={config.title} 
                                onChange={(e) => setConfig({...config, title: e.target.value})} 
                                disabled={readOnly}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">説明/指示</Label>
                            <Input 
                                id="description" 
                                value={config.description} 
                                onChange={(e) => setConfig({...config, description: e.target.value})} 
                                disabled={readOnly}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="assignedTo">担当者</Label>
                            <Select 
                                value={config.assignedTo} 
                                onValueChange={(val) => setConfig({...config, assignedTo: val})}
                                disabled={readOnly}
                            >
                                <SelectTrigger id="assignedTo">
                                    <SelectValue placeholder="担当者を選択" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="applicant">申請者</SelectItem>
                                    {/* Future: User/Group selection */}
                                </SelectContent>
                            </Select>
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

export default memo(InputNode);
