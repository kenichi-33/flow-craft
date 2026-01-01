'use client';

import React, { useState } from 'react';
import { NodeProps, useReactFlow, NodeResizer } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';

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
    };
}

// スイムレーンノード - BPMN Pool/Lane スタイル
export default function SwimLaneNode({ id, data, selected }: SwimLaneNodeProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'レーン');
    const [assignee, setAssignee] = useState(data.assignee || '');
    const [assigneeType, setAssigneeType] = useState(data.assigneeType || 'role');
    const [color, setColor] = useState(data.color || '#e3f2fd');
    const [width, setWidth] = useState(data.width || 800);
    const [height, setHeight] = useState(data.height || 200);

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
                            assignee,
                            assigneeType,
                            color,
                            width,
                            height,
                        },
                        style: {
                            ...node.style,
                            width,
                            height,
                        }
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const LANE_COLORS = [
        { label: '青', value: '#e3f2fd' },
        { label: 'ピンク', value: '#fce4ec' },
        { label: '緑', value: '#e8f5e9' },
        { label: 'オレンジ', value: '#fff3e0' },
        { label: '紫', value: '#f3e5f5' },
        { label: 'シアン', value: '#e0f7fa' },
    ];

    return (
        <>
            {/* リサイズハンドル */}
            <NodeResizer
                color="#90caf9"
                isVisible={selected}
                minWidth={300}
                minHeight={100}
            />
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    background: data.color || '#e3f2fd',
                    border: '2px solid #90caf9',
                    borderRadius: 1,
                    position: 'relative',
                    zIndex: -10,
                }}
            >
                {/* レーンヘッダー（左側） */}
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 40,
                        bgcolor: 'rgba(0,0,0,0.05)',
                        borderRight: '1px solid #90caf9',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 'bold',
                            transform: 'rotate(180deg)',
                            userSelect: 'none',
                        }}
                    >
                        {data.label}
                    </Typography>
                    {data.assignee && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, transform: 'rotate(180deg)' }}>
                            {data.assigneeType === 'user' ? (
                                <PersonIcon sx={{ fontSize: 12 }} />
                            ) : (
                                <GroupIcon sx={{ fontSize: 12 }} />
                            )}
                            <Typography variant="caption" sx={{ fontSize: 10 }}>
                                {data.assignee}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* 編集ボタン */}
                <IconButton
                    size="small"
                    onClick={() => setDialogOpen(true)}
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        bgcolor: 'white',
                        boxShadow: 1,
                        '&:hover': { bgcolor: '#f5f5f5' },
                    }}
                >
                    <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>スイムレーン設定</DialogTitle>
                <DialogContent>
                    <TextField
                        label="レーン名"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        fullWidth
                        size="small"
                        sx={{ mt: 2, mb: 2 }}
                    />

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>担当者タイプ</InputLabel>
                        <Select
                            value={assigneeType}
                            onChange={(e) => setAssigneeType(e.target.value as any)}
                            label="担当者タイプ"
                        >
                            <MenuItem value="role">ロール</MenuItem>
                            <MenuItem value="department">部門</MenuItem>
                            <MenuItem value="user">ユーザー</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        label="担当者/ロール名"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        fullWidth
                        size="small"
                        placeholder={assigneeType === 'role' ? '例: 承認者' : assigneeType === 'department' ? '例: 経理部' : '例: user@example.com'}
                        sx={{ mb: 2 }}
                    />

                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                        <InputLabel>レーン色</InputLabel>
                        <Select
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            label="レーン色"
                        >
                            {LANE_COLORS.map((c) => (
                                <MenuItem key={c.value} value={c.value}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 20, height: 20, bgcolor: c.value, borderRadius: 0.5, border: '1px solid #ccc' }} />
                                        {c.label}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="幅 (px)"
                            type="number"
                            value={width}
                            onChange={(e) => setWidth(Number(e.target.value))}
                            size="small"
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="高さ (px)"
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(Number(e.target.value))}
                            size="small"
                            sx={{ flex: 1 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                    <Button variant="contained" onClick={handleSave}>保存</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
