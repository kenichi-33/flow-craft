import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelector } from '@/components/common/UserSelector';
import { GroupSelector } from '@/components/common/GroupSelector';

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
                {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
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
                                <Label htmlFor="to">宛先 (Email, User, Group, 変数)</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="to" 
                                        value={config.to} 
                                        onChange={(e) => setConfig({...config, to: e.target.value})}
                                        placeholder="user@example.com, applicant, user:kb, group:dev"
                                        disabled={readOnly}
                                    />
                                </div>
                                {!readOnly && (
                                    <div className="flex flex-wrap gap-2 mt-2 p-2 bg-muted rounded-md border">
                                        <span className="text-xs font-bold text-muted-foreground w-full">宛先追加ヘルパー:</span>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfig(prev => ({ ...prev, to: prev.to ? `${prev.to}, applicant` : 'applicant' }))}>
                                            + 申請者
                                        </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfig(prev => ({ ...prev, to: prev.to ? `${prev.to}, applicant_manager` : 'applicant_manager' }))}>
                                            + 上長
                                        </Button>
                                        <div className="w-[180px]">
                                            <UserSelector 
                                                value=""
                                                onChange={(val) => val && setConfig(prev => ({ ...prev, to: prev.to ? `${prev.to}, user:${val}` : `user:${val}` }))}
                                                placeholder="+ ユーザーを追加..."
                                            />
                                        </div>
                                        <div className="w-[180px]">
                                            <GroupSelector 
                                                value=""
                                                onChange={(val) => val && setConfig(prev => ({ ...prev, to: prev.to ? `${prev.to}, group:${val}` : `group:${val}` }))}
                                                placeholder="+ 部署を追加..."
                                            />
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    カンマ区切りで複数指定可能。直接Emailアドレスも使用できます。<br/>
                                    ※ `applicant` や `user:xxx` はそのまま入力してください。<br/>
                                    ※ フォーム入力値を参照する場合は {'{{input.fieldId}}'} のように記述します。
                                </p>
                                {config.to.includes('manager') && !config.to.includes('applicant_manager') && (
                                     <p className="text-xs text-amber-600 font-bold mt-1">
                                         注意: "manager" は無効なキーワードです。"applicant_manager" (上長) を使用してください。
                                     </p>
                                )}
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
                                <Label htmlFor="templateSelect">テンプレート選択</Label>
                                <Select onValueChange={(val) => {
                                    if (val === 'approval_request') {
                                        setConfig(prev => ({
                                            ...prev,
                                            templateId: val,
                                            subject: '【{{applicationDefinition.name}}】承認依頼: {{application.title}}',
                                            body: '申請「{{application.title}}」の承認依頼が届いています。\n\nアプリ: {{applicationDefinition.name}}\n申請者: {{applicant.name}}\nリンク: {{applicationUrl}}'
                                        }));
                                    } else if (val === 'approval_remind') {
                                        setConfig(prev => ({
                                            ...prev,
                                            templateId: val,
                                            subject: '【{{applicationDefinition.name}}】リマインド: 承認期限が迫っています',
                                            body: '以下の申請の承認をお願いします。\n\nアプリ: {{applicationDefinition.name}}\n件名: {{application.title}}\n期限: {{task.dueDate}}'
                                        }));
                                    } else if (val === 'notification_default') {
                                        setConfig(prev => ({
                                            ...prev,
                                            templateId: val,
                                            subject: '【{{applicationDefinition.name}}】通知: {{application.title}}',
                                            body: 'システムからの通知です。\n\nアプリ: {{applicationDefinition.name}}\n\n{{input.message}}'
                                        }));
                                    }
                                }} disabled={readOnly}>
                                    <SelectTrigger><SelectValue placeholder="テンプレートを選択..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="approval_request">承認依頼メール</SelectItem>
                                        <SelectItem value="approval_remind">承認督促メール</SelectItem>
                                        <SelectItem value="notification_default">汎用通知メール</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="templateId">テンプレートID (手動入力)</Label>
                                <Input 
                                    id="templateId" 
                                    value={config.templateId} 
                                    onChange={(e) => setConfig({...config, templateId: e.target.value})}
                                    placeholder="template_001"
                                    disabled={readOnly}
                                />
                                <p className="text-xs text-muted-foreground">
                                    サーバー側で定義されたカスタムテンプレートIDを指定することも可能です
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
