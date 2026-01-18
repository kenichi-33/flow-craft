import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Pencil } from 'lucide-react';
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

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SendEmailNode = ({ data }: any) => {
    const [open, setOpen] = React.useState(false);
    const [config, setConfig] = React.useState({
        label: data.label || '',
        to: data.to || '',
        subject: data.subject || '',
        body: data.body || '',
        templateId: data.templateId || '',
    });

    const handleSave = () => {
        data.label = config.label;
        data.to = config.to;
        data.subject = config.subject;
        data.body = config.body;
        data.templateId = config.templateId;
        setOpen(false);
    };

    const { readOnly } = data;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-blue-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{config.label || 'メール送信'}</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1 truncate max-w-[120px]">
                    {config.to ? `To: ${config.to}` : '設定なし'}
                </div>
                <Handle type="source" position={Position.Right} className="!bg-blue-800 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>メール送信設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <Tabs defaultValue="basic">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="basic">基本設定</TabsTrigger>
                            <TabsTrigger value="template">テンプレート</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="basic" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="label">ステップ名</Label>
                                <Input 
                                    id="label" 
                                    value={config.label} 
                                    onChange={(e) => setConfig({...config, label: e.target.value})}
                                    placeholder="メール送信"
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="to">宛先 (Email or 変数)</Label>
                                <Input 
                                    id="to" 
                                    value={config.to} 
                                    onChange={(e) => setConfig({...config, to: e.target.value})}
                                    placeholder="user@example.com or {{applicant.email}}"
                                    disabled={readOnly}
                                />
                                <p className="text-xs text-muted-foreground">
                                    直接入力または変数 (例: {'{{applicant.email}}'}) が使用可能です
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="subject">件名</Label>
                                <Input 
                                    id="subject" 
                                    value={config.subject} 
                                    onChange={(e) => setConfig({...config, subject: e.target.value})}
                                    placeholder="[承認依頼] {{application.title}}"
                                    disabled={readOnly}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="body">本文</Label>
                                <Textarea 
                                    id="body" 
                                    value={config.body} 
                                    onChange={(e) => setConfig({...config, body: e.target.value})}
                                    placeholder="申請内容をご確認ください..."
                                    rows={5}
                                    disabled={readOnly}
                                />
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="template" className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="templateId">テンプレートID (オプション)</Label>
                                <Input 
                                    id="templateId" 
                                    value={config.templateId} 
                                    onChange={(e) => setConfig({...config, templateId: e.target.value})}
                                    placeholder="template_001"
                                    disabled={readOnly}
                                />
                                <p className="text-xs text-muted-foreground">
                                    事前定義されたテンプレートを使用する場合に入力してください
                                </p>
                            </div>
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
};

export default memo(SendEmailNode);
