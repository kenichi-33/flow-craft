'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

// Parallel Gateway Node - One input, multiple parallel outputs
export default function ParallelGatewayNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '並行');
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
                    background: '#ffeb3b', // Yellow
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
                    <AddIcon sx={{ color: '#f57f17', fontSize: 32 }} />
                </Box>

                {/* Input Handle (Top-Left in diamond -> Top visually) */}
                <Handle
                    type="target"
                    position={Position.Top}
                    id="input"
                    style={{
                        top: 0,
                        left: 0,
                        transform: 'translate(-50%, -50%)',
                        background: '#fbc02d',
                        width: 8,
                        height: 8,
                    }}
                />

                {/* Output Handle (Bottom-Right in diamond -> Bottom visually) */}
                {/* Note: In ReactFlow, multiple edges can come from one handle by default unless restricted. */}
                {/* We will rely on validation to allow multiple edges from here but restrict others. */}
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="output"
                    style={{
                        bottom: 0,
                        right: 0,
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
                {data.label || '並行'}
            </Typography>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>並行ゲートウェイ設定</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="ラベル"
                        fullWidth
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
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
