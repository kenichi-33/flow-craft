'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button
} from '@mui/material';
import CallSplitIcon from '@mui/icons-material/CallSplit';

// Parallel Gateway Node - 分岐専用（全ての後続タスクを並行生成）
export default function ParallelGatewayNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '分岐');
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
                            mode: 'split', // 常にsplit
                        }
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    return (
        <>
            <Box
                sx={{
                    width: 50,
                    height: 50,
                    transform: 'rotate(45deg)',
                    background: '#ffeb3b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    border: '2px solid #fbc02d',
                    position: 'relative',
                    cursor: 'pointer',
                }}
                onDoubleClick={() => setDialogOpen(true)}
            >
                <Box
                    sx={{
                        transform: 'rotate(-45deg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <CallSplitIcon sx={{ color: '#f57f17', fontSize: 28 }} />
                </Box>

                <Handle
                    type="target"
                    position={Position.Left}
                    id="input"
                    style={{
                        left: 0,
                        top: 0,
                        transform: 'translate(-50%, -50%)',
                        background: '#fbc02d',
                        width: 8,
                        height: 8,
                    }}
                />

                <Handle
                    type="source"
                    position={Position.Right}
                    id="output"
                    style={{
                        right: 0,
                        bottom: 0,
                        transform: 'translate(50%, 50%)',
                        background: '#fbc02d',
                        width: 8,
                        height: 8,
                    }}
                />
            </Box>

            <Typography
                variant="caption"
                sx={{
                    position: 'absolute',
                    top: 55,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 100,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px white',
                    pointerEvents: 'none',
                }}
            >
                {data.label || '分岐'}
            </Typography>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>並行分岐の設定</DialogTitle>
                <DialogContent>
                    <TextField
                        margin="dense"
                        label="ラベル"
                        fullWidth
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        sx={{ mt: 1 }}
                        helperText="全ての後続タスクを並行して生成します"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                    <Button onClick={handleSave} variant="contained">保存</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
