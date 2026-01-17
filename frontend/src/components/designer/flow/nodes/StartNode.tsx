// StartNode - Converted from MUI to Tailwind
import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Clock, Globe, MousePointerClick } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function StartNode({ id, data }: { id: string, data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [fieldPermissions, setFieldPermissions] = useState<Record<string, 'editable' | 'readonly' | 'hidden'>>(data.fieldPermissions || {});
    const [triggerType, setTriggerType] = useState<string>(data.triggerType || 'manual');
    const [scheduleCron, setScheduleCron] = useState<string>(data.scheduleCron || '');
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            setFieldPermissions(data.fieldPermissions || {});
            setTriggerType(data.triggerType || 'manual');
            setScheduleCron(data.scheduleCron || '');
        }
    }, [dialogOpen, data.fieldPermissions, data.triggerType, data.scheduleCron]);

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: { 
                            ...node.data, 
                            fieldPermissions,
                            triggerType,
                            scheduleCron
                        },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const getIcon = () => {
        switch (data.triggerType) {
            case 'scheduled': return <Clock className="h-5 w-5 text-white" />;
            case 'webhook': return <Globe className="h-5 w-5 text-white" />;
            default: return null;
        }
    };

    return (
        <>
            <div 
                className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-green-500 to-green-700 flex flex-col items-center justify-center shadow-lg border-[3px] border-white relative group"
                style={{ cursor: 'pointer' }}
                onClick={() => setDialogOpen(true)}
            >
                {getIcon() || (
                    <span className="text-xs text-white font-bold drop-shadow-sm select-none">
                        {data.label || '開始'}
                    </span>
                )}
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
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-2">
                             <TabsTrigger value="general">一般設定</TabsTrigger>
                            <TabsTrigger value="fields">権限設定</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="general" className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>トリガータイプ</Label>
                                <RadioGroup defaultValue={triggerType} onValueChange={setTriggerType} className="grid grid-cols-3 gap-2" disabled={isReadOnly}>
                                    <div>
                                        <RadioGroupItem value="manual" id="manual" className="peer sr-only" />
                                        <Label
                                            htmlFor="manual"
                                            className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <MousePointerClick className="mb-2 h-6 w-6" />
                                            手動
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="scheduled" id="scheduled" className="peer sr-only" />
                                        <Label
                                            htmlFor="scheduled"
                                            className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <Clock className="mb-2 h-6 w-6" />
                                            スケジュール
                                        </Label>
                                    </div>
                                    <div>
                                        <RadioGroupItem value="webhook" id="webhook" className="peer sr-only" />
                                        <Label
                                            htmlFor="webhook"
                                            className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <Globe className="mb-2 h-6 w-6" />
                                            Webhook
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {triggerType === 'scheduled' && (
                                <div className="space-y-2">
                                    <Label>スケジュール (Cron式)</Label>
                                    <Input 
                                        value={scheduleCron} 
                                        onChange={(e) => setScheduleCron(e.target.value)} 
                                        placeholder="0 9 * * 1 (毎週月曜 9:00)" 
                                        disabled={isReadOnly}
                                    />
                                    <p className="text-xs text-muted-foreground">CRON形式で入力してください。</p>
                                </div>
                            )}

                            {triggerType === 'webhook' && (
                                <div className="space-y-2">
                                    <Label>Webhook URL</Label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 p-2 bg-muted rounded text-xs text-muted-foreground break-all font-mono border">
                                           {data.webhookToken 
                                             ? `${window.location.origin}/api/webhooks/${data.webhookToken}`
                                             : `${window.location.origin}/api/webhooks/${data.applicationId || '<AppID>'}`
                                           }
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8"
                                            onClick={() => {
                                                const url = data.webhookToken 
                                                    ? `${window.location.origin}/api/webhooks/${data.webhookToken}`
                                                    : `${window.location.origin}/api/webhooks/${data.applicationId || '<AppID>'}`;
                                                navigator.clipboard.writeText(url);
                                            }}
                                        >
                                            <div className="h-4 w-4" >📋</div>
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        ※ このURLへのPOSTリクエストでワークフローを開始します。
                                        {!data.webhookToken && <span className="text-orange-600 block">トークンが発行されていないため、保存後に正確なURLが生成されます。</span>}
                                    </p>
                                </div>
                            )}
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
                                                            className="h-4 w-4"
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'readonly'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'readonly' }))}
                                                            className="h-4 w-4"
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'hidden'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'hidden' }))}
                                                            className="h-4 w-4"
                                                            disabled={isReadOnly}
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
                        {isReadOnly ? (
                            <Button onClick={() => setDialogOpen(false)}>閉じる</Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                                <Button onClick={handleSave}>保存</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
