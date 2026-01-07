'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

// Join Gateway Node - Multiple inputs, one output
export default function JoinGatewayNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '合流');
    const { setNodes } = useReactFlow();

    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) return;
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
                    {/* Same icon as Parallel but logically distinct */}
                    <AddIcon sx={{ color: '#f57f17', fontSize: 32 }} />
                </Box>

                {/* Input Handle */}
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

                {/* Output Handle */}
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
                {data.label || '合流'}
            </Typography>

            {/* Unified Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>{isReadOnly ? '合流ゲートウェイ設定 (読取専用)' : '合流ゲートウェイ設定'}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="ラベル"
                        fullWidth
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        disabled={isReadOnly}
                    />
                </DialogContent>
                <DialogActions>
                    {isReadOnly ? (
                        <Button onClick={() => setDialogOpen(false)} variant="contained">閉じる</Button>
                    ) : (
                        <>
                            <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                            <Button onClick={handleSave} variant="contained">保存</Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
}
