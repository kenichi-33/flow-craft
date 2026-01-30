// SwimLaneNode - Converted from MUI to shadcn/ui
import { useState } from 'react';
import { useReactFlow, NodeResizer } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, User, Users } from 'lucide-react';

interface SwimLaneNodeProps {
    id: string;
    selected?: boolean;
    data: {
        label: string;
        assignee?: string;
        assigneeType?: 'user' | 'role' | 'department';
        color?: string;
        width?: number;
        height?: number;
        readOnly?: boolean;
    };
}

const LANE_COLORS = [
    { label: '青', value: '#e3f2fd' },
    { label: 'ピンク', value: '#fce4ec' },
    { label: '緑', value: '#e8f5e9' },
    { label: 'オレンジ', value: '#fff3e0' },
    { label: '紫', value: '#f3e5f5' },
    { label: 'シアン', value: '#e0f7fa' },
];

const AVAILABLE_ROLES = [
    { value: 'wf_user', label: '一般利用者' },
    { value: 'wf_approver', label: '承認者' },
    { value: 'wf_manager', label: '管理職' },
    { value: 'wf_admin', label: 'システム管理者' },
];

export default function SwimLaneNode({ id, data, selected }: SwimLaneNodeProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'レーン');
    const [assignee, setAssignee] = useState(data.assignee || '');
    const [assigneeType, setAssigneeType] = useState(data.assigneeType || 'role');
    const [color, setColor] = useState(data.color || '#e3f2fd');
    const [width, setWidth] = useState(data.width || 800);
    const [height, setHeight] = useState(data.height || 200);
    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) return;
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, label, assignee, assigneeType, color, width, height }, style: { ...node.style, width, height } }
                    : node
            )
        );
        setDialogOpen(false);
    };

    return (
        <>
            {!isReadOnly && <NodeResizer color="#90caf9" isVisible={selected} minWidth={300} minHeight={100} />}
            <div
                className="w-full h-full rounded border-2 border-blue-300 relative"
                style={{ background: data.color || '#e3f2fd', cursor: isReadOnly ? 'pointer' : 'default', zIndex: -1 }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                {/* Lane Header (left side) */}
                <div className="absolute left-0 top-0 bottom-0 w-10 bg-black/5 border-r border-blue-300 flex flex-col items-center justify-center writing-vertical-lr">
                    <span className="font-bold text-sm select-none" style={{ writingMode: 'vertical-lr' }}>{data.label}</span>
                    {data.assignee && (
                        <div className="flex items-center gap-0.5 mt-1">
                            {data.assigneeType === 'user' ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                            <span className="text-[10px]">
                                {assigneeType === 'role' 
                                    ? (AVAILABLE_ROLES.find(r => r.value === data.assignee)?.label || data.assignee)
                                    : data.assignee}
                            </span>
                        </div>
                    )}
                </div>
                {!isReadOnly && (
                    <button
                        className="absolute top-1 right-1 w-6 h-6 bg-white rounded shadow flex items-center justify-center hover:bg-gray-100"
                        onClick={() => setDialogOpen(true)}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Pencil className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{isReadOnly ? 'スイムレーン (読取専用)' : 'スイムレーン設定'}</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>レーン名</Label>
                            <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={isReadOnly} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>担当者タイプ</Label>
                            <Select value={assigneeType} onValueChange={(v) => { setAssigneeType(v as any); setAssignee(''); }} disabled={isReadOnly}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="role">ロール</SelectItem>
                                    <SelectItem value="department">部門</SelectItem>
                                    <SelectItem value="user">ユーザー</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>担当者/ロール名</Label>
                            {assigneeType === 'role' ? (
                                <Select value={assignee} onValueChange={setAssignee} disabled={isReadOnly}>
                                    <SelectTrigger><SelectValue placeholder="ロールを選択" /></SelectTrigger>
                                    <SelectContent>
                                        {AVAILABLE_ROLES.map((role) => (
                                            <SelectItem key={role.value} value={role.value}>
                                                {role.label} ({role.value})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                    placeholder={assigneeType === 'department' ? '例: 経理部' : '例: user@example.com'}
                                    disabled={isReadOnly}
                                />
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label>レーン色</Label>
                            <Select value={color} onValueChange={setColor} disabled={isReadOnly}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {LANE_COLORS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border" style={{ backgroundColor: c.value }} />{c.label}</div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5"><Label>幅 (px)</Label><Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={isReadOnly} /></div>
                            <div className="space-y-1.5"><Label>高さ (px)</Label><Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} disabled={isReadOnly} /></div>
                        </div>
                    </div>
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
