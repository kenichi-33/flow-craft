'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';

// BPMN-style Approval/Task Node (Rounded Rectangle)
export default function ApprovalNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '承認');
    const [assignee, setAssignee] = useState(data.assignee || '');
    const { setNodes } = useReactFlow();

    const handleSave = () => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, label, assignee } }
                    : node
            )
        );
        setDialogOpen(false);
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

                {data.assignee && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
                        <PersonIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />
                        <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}
                        >
                            {data.assignee}
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

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
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
                    <TextField
                        label="担当者/ロール"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        fullWidth
                        sx={{ mt: 2 }}
                        placeholder="例: manager, finance-team"
                        helperText="担当者名またはロールを入力"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                    <Button variant="contained" onClick={handleSave}>保存</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
