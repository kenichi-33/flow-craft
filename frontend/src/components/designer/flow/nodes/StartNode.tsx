// StartNode - Converted from MUI to Tailwind
import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil } from 'lucide-react';

export default function StartNode({ id, data }: { id: string, data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [fieldPermissions, setFieldPermissions] = useState<Record<string, 'editable' | 'readonly' | 'hidden'>>(data.fieldPermissions || {});
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            setFieldPermissions(data.fieldPermissions || {});
        }
    }, [dialogOpen, data.fieldPermissions]);

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: { ...node.data, fieldPermissions },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    return (
        <>
            <div 
                className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-green-500 to-green-700 flex flex-col items-center justify-center shadow-lg border-[3px] border-white relative group"
                style={{ cursor: isReadOnly ? 'default' : 'pointer' }}
                onClick={isReadOnly ? undefined : () => setDialogOpen(true)}
            >
                <span className="text-xs text-white font-bold drop-shadow-sm select-none">
                    {data.label || '開始'}
                </span>
                {!isReadOnly && (
                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="bg-white rounded-full p-1 shadow-sm border">
                            <Pencil className="h-3 w-3 text-gray-500" />
                        </div>
                    </div>
                )}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!bg-green-700 !w-2.5 !h-2.5 !border-2 !border-white"
                />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>開始イベントの設定</DialogTitle></DialogHeader>
                    <Tabs defaultValue="fields">
                        <TabsList className="grid w-full grid-cols-1">
                            <TabsTrigger value="fields">権限設定</TabsTrigger>
                        </TabsList>
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
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'readonly'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'readonly' }))}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'hidden'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'hidden' }))}
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
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={handleSave}>保存</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
