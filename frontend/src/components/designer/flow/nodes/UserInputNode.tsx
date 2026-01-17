// InputNode - Converted from MUI to shadcn/ui
import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function UserInputNode({ data, id }: { data: any, id: string }) {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();
    const [config, setConfig] = useState({
        title: data.title || '追加情報の入力',
        description: data.description || '以下の情報を入力してください',
        assignedTo: data.assignedTo || 'applicant',
    });
    const [fieldPermissions, setFieldPermissions] = useState<Record<string, 'editable' | 'readonly' | 'hidden'>>(data.fieldPermissions || {});

    // Sync state when dialog opens
    useEffect(() => {
        if (open) {
            setConfig({
                title: data.title || '追加情報の入力',
                description: data.description || '以下の情報を入力してください',
                assignedTo: data.assignedTo || 'applicant',
            });
            setFieldPermissions(data.fieldPermissions || {});
        }
    }, [open, data]);

    const handleSave = () => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            title: config.title,
                            description: config.description,
                            assignedTo: config.assignedTo,
                            fieldPermissions,
                        },
                    }
                    : node
            )
        );
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
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
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>入力タスク設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="general">一般設定</TabsTrigger>
                            <TabsTrigger value="fields">権限設定</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 pt-4">
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
                                    <SelectTrigger id="assignedTo" className="w-full">
                                        <SelectValue placeholder="担当者を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="applicant">申請者</SelectItem>
                                        {/* Future: User/Group selection */}
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="fields" className="space-y-4 pt-4">
                             <div className="rounded-md border">
                                <div className="grid grid-cols-12 bg-muted p-2 text-xs font-medium text-muted-foreground border-b">
                                    <div className="col-span-6 pl-2">フィールド名</div>
                                    <div className="col-span-2 text-center">編集</div>
                                    <div className="col-span-2 text-center">読取</div>
                                    <div className="col-span-2 text-center">非表示</div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {(!data.formFields || data.formFields.length === 0) ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">フォーム定義がありません</div>
                                    ) : (
                                        data.formFields.map((field: any) => {
                                            const currentPerm = fieldPermissions[field.id] || 'editable';
                                            return (
                                                <div key={field.id} className="grid grid-cols-12 p-2 border-b last:border-0 items-center hover:bg-muted/50">
                                                    <div className="col-span-6 pl-2 text-sm truncate" title={field.label}>
                                                        {field.label} <span className="text-xs text-muted-foreground">({field.id})</span>
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'editable'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'editable' }))}
                                                            disabled={readOnly}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'readonly'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'readonly' }))}
                                                            disabled={readOnly}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'hidden'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'hidden' }))}
                                                            disabled={readOnly}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                ※ デフォルトでは全ての項目が「編集可能」です。
                            </p>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>閉じる</Button>
                        {!readOnly && <Button onClick={handleSave}>保存</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
