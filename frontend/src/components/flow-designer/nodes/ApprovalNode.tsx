'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Chip, FormHelperText
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';

// 担当者タイプ
type AssigneeType = 'role' | 'group' | 'specific' | 'applicant_manager';

// 選択可能なロール
const AVAILABLE_ROLES = [
    { value: 'wf_user', label: '一般利用者' },
    { value: 'wf_approver', label: '承認者' },
    { value: 'wf_manager', label: '管理職' },
    { value: 'wf_admin', label: 'システム管理者' },
];

// 選択可能なグループ（部署）
const AVAILABLE_GROUPS = [
    { value: '/Company/営業部', label: '営業部' },
    { value: '/Company/営業部/営業第一課', label: '営業第一課' },
    { value: '/Company/営業部/営業第二課', label: '営業第二課' },
    { value: '/Company/経理部', label: '経理部' },
    { value: '/Company/IT部', label: 'IT部' },
    { value: '/Company/IT部/システム課', label: 'システム課' },
];

// BPMN-style Approval/Task Node (Rounded Rectangle)
export default function ApprovalNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '承認');
    const [assigneeType, setAssigneeType] = useState<AssigneeType>(data.assigneeType || 'role');
    const [assigneeRole, setAssigneeRole] = useState(data.assigneeRole || 'wf_approver');
    const [assigneeGroup, setAssigneeGroup] = useState(data.assigneeGroup || '');
    const [assigneeUser, setAssigneeUser] = useState(data.assigneeUser || '');
    const { setNodes } = useReactFlow();

    const handleSave = () => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            label,
                            assigneeType,
                            assigneeRole: assigneeType === 'role' ? assigneeRole : undefined,
                            assigneeGroup: assigneeType === 'group' ? assigneeGroup : undefined,
                            assigneeUser: assigneeType === 'specific' ? assigneeUser : undefined,
                            // 表示用のassignee（互換性維持）
                            assignee: getAssigneeDisplay(),
                        },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const getAssigneeDisplay = () => {
        switch (assigneeType) {
            case 'role':
                return AVAILABLE_ROLES.find(r => r.value === assigneeRole)?.label || assigneeRole;
            case 'group':
                return AVAILABLE_GROUPS.find(g => g.value === assigneeGroup)?.label || assigneeGroup;
            case 'specific':
                return assigneeUser || '指定ユーザー';
            case 'applicant_manager':
                return '申請者の上長';
            default:
                return '';
        }
    };

    const getAssigneeIcon = () => {
        switch (assigneeType) {
            case 'role':
                return <SecurityIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />;
            case 'group':
                return <GroupIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />;
            default:
                return <PersonIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />;
        }
    };

    return (
        <>
            <Box
                sx={{
                    minWidth: 140,
                    minHeight: 60,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
                    border: '2px solid rgba(255,255,255,0.5)',
                    position: 'relative',
                }}
            >
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{
                        background: '#1565c0',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'white',
                            fontWeight: 'bold',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}
                    >
                        {data.label || '承認'}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={() => setDialogOpen(true)}
                        onMouseDown={(e) => e.stopPropagation()}
                        sx={{ color: 'white', p: 0.3 }}
                    >
                        <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Box>

                {(data.assignee || data.assigneeType) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
                        {getAssigneeIcon()}
                        <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}
                        >
                            {data.assignee || getAssigneeDisplay()}
                        </Typography>
                    </Box>
                )}

                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{
                        background: '#1565c0',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>承認ステップの設定</DialogTitle>
                <DialogContent>
                    <TextField
                        label="ステップ名"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        fullWidth
                        sx={{ mt: 2 }}
                        placeholder="例: 部長承認、経理確認"
                    />

                    <FormControl fullWidth sx={{ mt: 3 }}>
                        <InputLabel>担当者の指定方法</InputLabel>
                        <Select
                            value={assigneeType}
                            label="担当者の指定方法"
                            onChange={(e) => setAssigneeType(e.target.value as AssigneeType)}
                        >
                            <MenuItem value="role">ロールで指定</MenuItem>
                            <MenuItem value="group">部署・グループで指定</MenuItem>
                            <MenuItem value="specific">特定ユーザーを指定</MenuItem>
                            <MenuItem value="applicant_manager">申請者の上長</MenuItem>
                        </Select>
                        <FormHelperText>
                            {assigneeType === 'role' && 'このロールを持つユーザーが承認可能'}
                            {assigneeType === 'group' && 'この部署に所属するユーザーが承認可能'}
                            {assigneeType === 'specific' && '指定したユーザーのみ承認可能'}
                            {assigneeType === 'applicant_manager' && '申請者の直属上長が承認'}
                        </FormHelperText>
                    </FormControl>

                    {assigneeType === 'role' && (
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>必要なロール</InputLabel>
                            <Select
                                value={assigneeRole}
                                label="必要なロール"
                                onChange={(e) => setAssigneeRole(e.target.value)}
                            >
                                {AVAILABLE_ROLES.map((role) => (
                                    <MenuItem key={role.value} value={role.value}>
                                        <Chip label={role.label} size="small" sx={{ mr: 1 }} />
                                        {role.value}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {assigneeType === 'group' && (
                        <FormControl fullWidth sx={{ mt: 2 }}>
                            <InputLabel>担当部署</InputLabel>
                            <Select
                                value={assigneeGroup}
                                label="担当部署"
                                onChange={(e) => setAssigneeGroup(e.target.value)}
                            >
                                {AVAILABLE_GROUPS.map((group) => (
                                    <MenuItem key={group.value} value={group.value}>
                                        {group.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {assigneeType === 'specific' && (
                        <TextField
                            label="ユーザー名"
                            value={assigneeUser}
                            onChange={(e) => setAssigneeUser(e.target.value)}
                            fullWidth
                            sx={{ mt: 2 }}
                            placeholder="例: tanaka, admin"
                            helperText="Keycloakのユーザー名を入力"
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                    <Button variant="contained" onClick={handleSave}>保存</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
