// ApprovalNode - Converted from MUI to shadcn/ui
import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { UserSelector } from '@/components/common/UserSelector';
import { GroupSelector } from '@/components/common/GroupSelector';
import { Pencil, User, Users, Shield, Mail } from 'lucide-react';

type AssigneeType = 'role' | 'group' | 'specific' | 'applicant_manager';

const AVAILABLE_ROLES = [
    { value: 'wf_user', label: '一般利用者' },
    { value: 'wf_approver', label: '承認者' },
    { value: 'wf_manager', label: '管理職' },
    { value: 'wf_admin', label: 'システム管理者' },
];

export default function ApprovalNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '承認');
    const [assigneeType, setAssigneeType] = useState<AssigneeType>(data.assigneeType || 'role');
    const [assigneeRole, setAssigneeRole] = useState(data.assigneeRole || 'wf_approver');
    const [assigneeGroup, setAssigneeGroup] = useState(data.assigneeGroup || '');
    const [assigneeGroupDisplay, setAssigneeGroupDisplay] = useState(data.assigneeGroupDisplay || '');
    const [assigneeUser, setAssigneeUser] = useState(data.assigneeUser || '');
    const [assigneeUserDisplay, setAssigneeUserDisplay] = useState(data.assigneeDisplay || (data.assigneeUser ? data.assigneeUser : ''));
    const [notificationEnabled, setNotificationEnabled] = useState(data.notificationEnabled || false);
    const [notificationSubject, setNotificationSubject] = useState(data.notificationSubject || '【Flow Craft】承認依頼: {{applicationDefinition.name}}');
    const [notificationBody, setNotificationBody] = useState(data.notificationBody || '{{assignee}} 様\n\n申請が届いています。\n確認をお願いします。');
    const [fieldPermissions, setFieldPermissions] = useState<Record<string, 'editable' | 'readonly' | 'hidden'>>(data.fieldPermissions || {});
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            // Reset state from data when dialog opens
            setFieldPermissions(data.fieldPermissions || {});
        }
    }, [dialogOpen, data.fieldPermissions]);

    const getAssigneeValue = () => {
        switch (assigneeType) {
            case 'role': return `role:${assigneeRole}`;
            case 'group': return `group:${assigneeGroup}`;
            case 'specific': return assigneeUser ? `user:${assigneeUser}` : '';
            case 'applicant_manager': return 'applicant_manager';
            default: return '';
        }
    };

    const getAssigneeDisplay = () => {
        switch (assigneeType) {
            case 'role': return AVAILABLE_ROLES.find(r => r.value === assigneeRole)?.label || assigneeRole;
            case 'group': return assigneeGroupDisplay || assigneeGroup;
            case 'specific': return assigneeUserDisplay || assigneeUser || '指定ユーザー';
            case 'applicant_manager': return '申請者の上長';
            default: return '';
        }
    };

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data, label, assigneeType,
                            assigneeRole: assigneeType === 'role' ? assigneeRole : undefined,
                            assigneeGroup: assigneeType === 'group' ? assigneeGroup : undefined,
                            assigneeGroupDisplay: assigneeType === 'group' ? assigneeGroupDisplay : undefined,
                            assigneeUser: assigneeType === 'specific' ? assigneeUser : undefined,
                            assignee: getAssigneeValue(),
                            assigneeDisplay: getAssigneeDisplay(),
                            notificationEnabled, notificationSubject, notificationBody,
                            fieldPermissions,
                        },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const AssigneeIcon = assigneeType === 'role' ? Shield : assigneeType === 'group' ? Users : User;

    return (
        <>
            <div
                className="min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex flex-col items-center justify-center shadow-lg border-2 border-white/50 relative"
                style={{ cursor: isReadOnly ? 'pointer' : 'default' }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                <Handle type="target" position={Position.Left} className="!bg-blue-700 !w-2.5 !h-2.5 !border-2 !border-white" />
                <div className="flex items-center gap-1">
                    {notificationEnabled && <Mail className="h-3 w-3 text-white/70" />}
                    <span className="text-sm text-white font-bold drop-shadow-sm">{data.label || '承認'}</span>
                    {!isReadOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                {(data.assignee || data.assigneeType) && (
                    <div className="flex items-center gap-0.5 mt-1">
                        <AssigneeIcon className="h-3 w-3 text-white/80" />
                        <span className="text-[10px] text-white/90">{data.assigneeDisplay || getAssigneeDisplay()}</span>
                    </div>
                )}
                <Handle type="source" position={Position.Right} className="!bg-blue-700 !w-2.5 !h-2.5 !border-2 !border-white" />
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{isReadOnly ? '承認ステップ (読取専用)' : '承認ステップの設定'}</DialogTitle></DialogHeader>
                    <Tabs defaultValue="basic">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basic">基本設定</TabsTrigger>
                            <TabsTrigger value="notification">通知設定</TabsTrigger>
                            <TabsTrigger value="fields">権限設定</TabsTrigger>
                        </TabsList>
                        <TabsContent value="basic" className="space-y-4 pt-4">
                            <div className="space-y-1.5">
                                <Label>ステップ名</Label>
                                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例: 部長承認、経理確認" disabled={isReadOnly} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>担当者の指定方法</Label>
                                <Select value={assigneeType} onValueChange={(v) => setAssigneeType(v as AssigneeType)} disabled={isReadOnly}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="role">ロールで指定</SelectItem>
                                        <SelectItem value="group">部署・グループで指定</SelectItem>
                                        <SelectItem value="specific">特定ユーザーを指定</SelectItem>
                                        <SelectItem value="applicant_manager">申請者の上長</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {assigneeType === 'role' && 'このロールを持つユーザーが承認可能'}
                                    {assigneeType === 'group' && 'この部署に所属するユーザーが承認可能'}
                                    {assigneeType === 'specific' && '指定したユーザーのみ承認可能'}
                                    {assigneeType === 'applicant_manager' && '申請者の直属上長が承認'}
                                </p>
                            </div>
                            {assigneeType === 'role' && (
                                <div className="space-y-1.5">
                                    <Label>必要なロール</Label>
                                    <Select value={assigneeRole} onValueChange={setAssigneeRole} disabled={isReadOnly}>
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
                                        disabled={isReadOnly}
                                    />
                                    <p className="text-xs text-muted-foreground">部署名で検索して選択してください</p>
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
                                        disabled={isReadOnly} 
                                    />
                                    <p className="text-xs text-muted-foreground">Keycloakのユーザー名を入力</p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="notification" className="space-y-4 pt-4">
                            <div className="flex items-center gap-2">
                                <Checkbox id="notification" checked={notificationEnabled} onCheckedChange={(c) => setNotificationEnabled(!!c)} disabled={isReadOnly} />
                                <Label htmlFor="notification" className="cursor-pointer">担当者にメール通知を送信する</Label>
                            </div>
                            {notificationEnabled ? (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>件名テンプレート</Label>
                                        <Input value={notificationSubject} onChange={(e) => setNotificationSubject(e.target.value)} disabled={isReadOnly} />
                                        <p className="text-xs text-muted-foreground">変数: {"{{applicationDefinition.name}}"}, {"{{assignee}}"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>本文テンプレート</Label>
                                        <Textarea value={notificationBody} onChange={(e) => setNotificationBody(e.target.value)} rows={6} disabled={isReadOnly} />
                                        <p className="text-xs text-muted-foreground">{"{{fieldName}}"}, {"{{assigneeName}}"}, {"{{assigneeDepartment}}"}, {"{{assigneeEmail}}"}</p>
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
                                                            disabled={isReadOnly}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'readonly'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'readonly' }))}
                                                            disabled={isReadOnly}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex justify-center">
                                                        <input 
                                                            type="radio" 
                                                            name={`perm-${field.id}`} 
                                                            checked={currentPerm === 'hidden'} 
                                                            onChange={() => setFieldPermissions(prev => ({ ...prev, [field.id]: 'hidden' }))}
                                                            disabled={isReadOnly}
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
                        {isReadOnly ? <Button onClick={() => setDialogOpen(false)}>閉じる</Button> : (
                            <><Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button><Button onClick={handleSave}>保存</Button></>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
