import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { MessageSquare, Pencil } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

const SlackNode = ({ id, data }: any) => {
    const { updateNodeData } = useReactFlow();
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState({
        label: data.label || '',
        webhookUrl: data.webhookUrl || '',
        message: data.message || '',
    });

    const handleSave = () => {
        updateNodeData(id, {
            ...data,
            label: config.label,
            webhookUrl: config.webhookUrl,
            message: config.message,
        });
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-indigo-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{config.label || 'Slack通知'}</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1 truncate max-w-[120px]">
                    {config.webhookUrl ? '設定済み' : '未設定'}
                </div>
                <Handle type="source" position={Position.Right} className="!bg-indigo-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                {/* Stats Badge */}
                {(() => {
                    const stats = data.statCount;
                    if (!stats) return null;
                    const count = typeof stats === 'number' ? stats : stats.count;
                    if (!count) return null;
                    
                    return (
                        <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                            {count}
                        </div>
                    );
                })()}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Slack/Teams通知設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="label">ステップ名</Label>
                            <Input 
                                id="label" 
                                value={config.label} 
                                onChange={(e) => setConfig({...config, label: e.target.value})}
                                placeholder="Slack通知"
                                disabled={readOnly}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="webhookUrl">Webhook URL</Label>
                            <Input 
                                id="webhookUrl" 
                                value={config.webhookUrl} 
                                onChange={(e) => setConfig({...config, webhookUrl: e.target.value})}
                                placeholder="https://hooks.slack.com/services/..."
                                disabled={readOnly}
                            />
                            <p className="text-xs text-muted-foreground">
                                Slack または Microsoft Teams の Incoming Webhook URL
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="message">メッセージ</Label>
                            <Textarea 
                                id="message" 
                                value={config.message} 
                                onChange={(e) => setConfig({...config, message: e.target.value})}
                                placeholder="通知メッセージ..."
                                rows={5}
                                disabled={readOnly}
                            />
                            <p className="text-xs text-muted-foreground">
                                変数 (例: {'{{application.title}}'}) が使用可能です
                            </p>
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

export default memo(SlackNode);
