// UserInputNode - Converted from MUI to shadcn/ui
import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Keyboard, Pencil, User, Users, Shield, Mail } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserSelector } from '@/components/common/UserSelector';
import { GroupSelector } from '@/components/common/GroupSelector';

type AssigneeType = 'role' | 'group' | 'specific' | 'applicant_manager' | 'applicant';

const AVAILABLE_ROLES = [
    { value: 'wf_user', label: '一般利用者' },
    { value: 'wf_approver', label: '承認者' },
    { value: 'wf_manager', label: '管理職' },
    { value: 'wf_admin', label: 'システム管理者' },
];

export default function UserInputNode({ data, id }: { data: any, id: string }) {
    const [open, setOpen] = useState(false);
    const { setNodes } = useReactFlow();
    
    // Config States
    const [label, setLabel] = useState(data.label || '入力タスク');
    const [title, setTitle] = useState(data.title || '追加情報の入力');
    const [description, setDescription] = useState(data.description || '以下の情報を入力してください');
    
    // Assignee States
    const [assigneeType, setAssigneeType] = useState<AssigneeType>(data.assigneeType || 'applicant');
    const [assigneeRole, setAssigneeRole] = useState(data.assigneeRole || 'wf_user');
    const [assigneeGroup, setAssigneeGroup] = useState(data.assigneeGroup || '');
    const [assigneeGroupDisplay, setAssigneeGroupDisplay] = useState(data.assigneeGroupDisplay || '');
    const [assigneeUser, setAssigneeUser] = useState(data.assigneeUser || '');
    const [assigneeUserDisplay, setAssigneeUserDisplay] = useState(data.assigneeDisplay || (data.assigneeUser ? data.assigneeUser : ''));
    
    // Notification States
    const [notificationEnabled, setNotificationEnabled] = useState(data.notificationEnabled || false);
    const [notificationSubject, setNotificationSubject] = useState(data.notificationSubject || '【Flow Craft】入力依頼: {{applicationDefinition.name}}');
    const [notificationBody, setNotificationBody] = useState(data.notificationBody || '{{assignee}} 様\n\n以下の情報の入力をお願いします。\n\n申請タイトル: {{application.title}}\n申請者: {{application.applicantId}}');
    
    const [fieldPermissions, setFieldPermissions] = useState<Record<string, 'editable' | 'readonly' | 'hidden'>>(data.fieldPermissions || {});

    // Sync state when dialog opens
    useEffect(() => {
        if (open) {
            setLabel(data.label || '入力タスク');
            setTitle(data.title || '追加情報の入力');
            setDescription(data.description || '以下の情報を入力してください');
            setAssigneeType(data.assigneeType || (data.assignedTo === 'applicant' ? 'applicant' : 'role')); // Fallback logic
            setAssigneeRole(data.assigneeRole || 'wf_user');
            setAssigneeGroup(data.assigneeGroup || '');
            setAssigneeGroupDisplay(data.assigneeGroupDisplay || '');
            setAssigneeUser(data.assigneeUser || '');
            setAssigneeUserDisplay(data.assigneeDisplay || '');
            
            setNotificationEnabled(data.notificationEnabled || false);
            setNotificationSubject(data.notificationSubject || '【Flow Craft】入力依頼: {{applicationDefinition.name}}');
            setNotificationBody(data.notificationBody || '{{assignee}} 様\n\n以下の情報の入力をお願いします。\n\n申請タイトル: {{application.title}}\n申請者: {{application.applicantId}}');
            
            setFieldPermissions(data.fieldPermissions || {});
        }
    }, [open, data]);

    const getAssigneeValue = () => {
        switch (assigneeType) {
            case 'role': return `role:${assigneeRole}`;
            case 'group': return `group:${assigneeGroup}`;
            case 'specific': return assigneeUser ? `user:${assigneeUser}` : '';
            case 'applicant_manager': return 'applicant_manager';
            case 'applicant': return 'applicant';
            default: return '';
        }
    };

    const getAssigneeDisplay = () => {
        switch (assigneeType) {
            case 'role': return AVAILABLE_ROLES.find(r => r.value === assigneeRole)?.label || assigneeRole;
            case 'group': return assigneeGroupDisplay || assigneeGroup;
            case 'specific': return assigneeUserDisplay || assigneeUser || '指定ユーザー';
            case 'applicant_manager': return '申請者の上長';
            case 'applicant': return '申請者 (本人)';
            default: return '';
        }
    };

    const handleSave = () => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            label,
                            title,
                            description,
                            assigneeType,
                            assigneeRole: assigneeType === 'role' ? assigneeRole : undefined,
                            assigneeGroup: assigneeType === 'group' ? assigneeGroup : undefined,
                            assigneeGroupDisplay: assigneeType === 'group' ? assigneeGroupDisplay : undefined,
                            assigneeUser: assigneeType === 'specific' ? assigneeUser : undefined,
                            assignee: getAssigneeValue(),
                            assigneeDisplay: getAssigneeDisplay(), // Save derived display immediately
                            assignedTo: getAssigneeValue(), // Backward compatibility
                            
                            notificationEnabled, notificationSubject, notificationBody,
                            fieldPermissions,
                        },
                    }
                    : node
            )
        );
        setOpen(false);
    };

    const { readOnly } = data;
    const AssigneeIcon = assigneeType === 'role' ? Shield : assigneeType === 'group' ? Users : User;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: readOnly ? 'pointer' : 'default' }}
                onClick={readOnly ? () => setOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-sky-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    {notificationEnabled && <Mail className="h-3 w-3 text-white/70" />}
                    <Keyboard className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{label || '入力タスク'}</span>
                    {!readOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded ml-1" onClick={() => setOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1 truncate max-w-[120px]">
                    {title}
                </div>
                {(data.assignee || data.assigneeType || data.assignedTo) && (
                    <div className="flex items-center gap-0.5 mt-1">
                        <AssigneeIcon className="h-3 w-3 text-white/80" />
                        <span className="text-[10px] text-white/90">{data.assigneeDisplay || getAssigneeDisplay() || '申請者'}</span>
                    </div>
                )}
                <Handle type="source" position={Position.Right} className="!bg-sky-800 !w-2.5 !h-2.5 !border-2 !border-white" />
                {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
            </div>
            
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>入力タスク設定 {readOnly && <span className="text-xs font-normal text-muted-foreground ml-2">(読み取り専用)</span>}</DialogTitle>
                    </DialogHeader>
                    
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="general">一般設定</TabsTrigger>
                            <TabsTrigger value="notification">通知</TabsTrigger>
                            <TabsTrigger value="fields">権限設定</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4 pt-4">
                             <div className="space-y-1.5">
                                <Label htmlFor="label">ステップ名</Label>
                                <Input 
                                    id="label" 
                                    value={label} 
                                    onChange={(e) => setLabel(e.target.value)} 
                                    disabled={readOnly}
                                    placeholder="例: 情報入力、アンケート回答"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="title">タスクタイトル (ユーザー表示)</Label>
                                <Input 
                                    id="title" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)} 
                                    disabled={readOnly}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="description">説明/指示</Label>
                                <Input 
                                    id="description" 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                    disabled={readOnly}
                                />
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label>担当者の指定方法</Label>
                                <Select value={assigneeType} onValueChange={(v) => setAssigneeType(v as AssigneeType)} disabled={readOnly}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="applicant">申請者 (本人)</SelectItem>
                                        <SelectItem value="role">ロールで指定</SelectItem>
                                        <SelectItem value="group">部署・グループで指定</SelectItem>
                                        <SelectItem value="specific">特定ユーザーを指定</SelectItem>
                                        <SelectItem value="applicant_manager">申請者の上長</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {assigneeType === 'applicant' && '申請者本人が情報を入力します'}
                                    {assigneeType === 'role' && 'このロールを持つユーザーが入力可能'}
                                    {assigneeType === 'group' && 'この部署に所属するユーザーが入力可能'}
                                    {assigneeType === 'specific' && '指定したユーザーのみ入力可能'}
                                    {assigneeType === 'applicant_manager' && '申請者の直属上長が入力'}
                                </p>
                            </div>

                            {assigneeType === 'role' && (
                                <div className="space-y-1.5">
                                    <Label>必要なロール</Label>
                                    <Select value={assigneeRole} onValueChange={setAssigneeRole} disabled={readOnly}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {AVAILABLE_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label} ({role.value})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {assigneeType === 'group' && (
                                <div className="space-y-1.5">
                                    <Label>担当部署・グループ</Label>
                                    <GroupSelector
                                        value={assigneeGroup}
                                        displayValue={assigneeGroupDisplay}
                                        onChange={(deptCode, group) => {
                                            setAssigneeGroup(deptCode);
                                            setAssigneeGroupDisplay(group?.name || '');
                                        }}
                                        placeholder="部署名またはチーム名で検索..."
                                        disabled={readOnly}
                                    />
                                </div>
                            )}
                            {assigneeType === 'specific' && (
                                <div className="space-y-1.5">
                                    <Label>ユーザー名</Label>
                                    <UserSelector 
                                        value={assigneeUser} 
                                        displayValue={assigneeUserDisplay}
                                        onChange={(val, user) => { 
                                            setAssigneeUser(val); 
                                            const name = user?.displayName || `${user?.lastName || ''} ${user?.firstName || ''}`.trim();
                                            const display = name ? `${name} (${user?.username})` : val;
                                            setAssigneeUserDisplay(user ? display : val); 
                                        }} 
                                        placeholder="例: user@example.com" 
                                        disabled={readOnly} 
                                    />
                                </div>
                            )}
                        </TabsContent>
                        
                        <TabsContent value="notification" className="space-y-4 pt-4">
                            <div className="flex items-center gap-2">
                                <Checkbox id="notification" checked={notificationEnabled} onCheckedChange={(c) => setNotificationEnabled(!!c)} disabled={readOnly} />
                                <Label htmlFor="notification" className="cursor-pointer">担当者にメール通知を送信する</Label>
                            </div>
                            {notificationEnabled ? (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>件名テンプレート</Label>
                                        <Input value={notificationSubject} onChange={(e) => setNotificationSubject(e.target.value)} disabled={readOnly} />
                                        <p className="text-xs text-muted-foreground">変数: {"{{applicationDefinition.name}}"}, {"{{assignee}}"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>本文テンプレート</Label>
                                        <Textarea value={notificationBody} onChange={(e) => setNotificationBody(e.target.value)} rows={6} disabled={readOnly} />
                                        <p className="text-xs text-muted-foreground">{"{{application.title}}"}, {"{{assignee}}"}</p>
                                    </div>
                                </>
                            ) : <p className="text-sm text-muted-foreground">通知機能は無効です。</p>}
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
