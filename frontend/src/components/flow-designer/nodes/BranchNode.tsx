'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel,
    Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

// BPMN-style Gateway/Branch Node (Diamond shape)
export default function BranchNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [conditionField, setConditionField] = useState(data.conditionField || '');
    const [conditionOperator, setConditionOperator] = useState<string>(data.conditionOperator || '==');
    const [conditionValue, setConditionValue] = useState(data.conditionValue || '');
    const [yesLabel, setYesLabel] = useState(data.yesLabel || 'はい');
    const [noLabel, setNoLabel] = useState(data.noLabel || 'いいえ');
    const { setNodes } = useReactFlow();

    const formFields = data.formFields || [];

    const handleSave = () => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            conditionField,
                            conditionOperator,
                            conditionValue,
                            yesLabel,
                            noLabel
                        }
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const getOperatorLabel = (op: string) => {
        switch (op) {
            case '==': return '=';
            case '!=': return '≠';
            case '>': return '>';
            case '<': return '<';
            case '>=': return '≥';
            case '<=': return '≤';
            case 'contains': return '∋';
            default: return op;
        }
    };

    return (
        <>
            {/* Diamond shape container */}
            <Box
                sx={{
                    width: 80,
                    height: 80,
                    position: 'relative',
                }}
            >
                {/* Diamond shape */}
                <Box
                    onClick={() => setDialogOpen(true)}
                    sx={{
                        width: 56,
                        height: 56,
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(45deg)',
                        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
                        boxShadow: '0 4px 12px rgba(255, 152, 0, 0.4)',
                        border: '2px solid rgba(255,255,255,0.5)',
                        borderRadius: 1,
                        cursor: 'pointer',
                    }}
                />

                {/* Content (not rotated) */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 1,
                        pointerEvents: 'none',
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'white',
                            fontWeight: 'bold',
                            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                            fontSize: 10,
                        }}
                    >
                        {data.conditionField ? getOperatorLabel(data.conditionOperator || '==') : '?'}
                    </Typography>
                </Box>

                {/* Edit button */}
                <IconButton
                    size="small"
                    onClick={() => setDialogOpen(true)}
                    sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'white',
                        boxShadow: 1,
                        p: 0.3,
                        '&:hover': { bgcolor: 'grey.100' },
                    }}
                >
                    <EditIcon sx={{ fontSize: 12 }} />
                </IconButton>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{
                        background: '#e65100',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                        left: -5,
                    }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    id="yes"
                    style={{
                        background: '#4caf50',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                        right: -5,
                    }}
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="no"
                    style={{
                        background: '#f44336',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                        bottom: -5,
                    }}
                />

                {/* Labels for yes/no */}
                <Typography
                    variant="caption"
                    sx={{
                        position: 'absolute',
                        right: -30,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#4caf50',
                        fontWeight: 'bold',
                        fontSize: 9,
                    }}
                >
                    {data.yesLabel || 'はい'}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        position: 'absolute',
                        bottom: -18,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        color: '#f44336',
                        fontWeight: 'bold',
                        fontSize: 9,
                    }}
                >
                    {data.noLabel || 'いいえ'}
                </Typography>
            </Box>

            {/* Settings Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>分岐条件の設定</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        フォームの値に基づいて分岐を設定します
                    </Typography>

                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>条件フィールド</InputLabel>
                        <Select
                            value={conditionField}
                            onChange={(e) => setConditionField(e.target.value)}
                            label="条件フィールド"
                        >
                            <MenuItem value="">
                                <em>選択してください</em>
                            </MenuItem>
                            {formFields.map((field: any) => (
                                <MenuItem key={field.id} value={field.id}>
                                    {field.label || field.id}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <FormControl sx={{ minWidth: 120 }}>
                            <InputLabel>演算子</InputLabel>
                            <Select
                                value={conditionOperator}
                                onChange={(e) => setConditionOperator(e.target.value)}
                                label="演算子"
                            >
                                <MenuItem value="==">等しい (=)</MenuItem>
                                <MenuItem value="!=">等しくない (≠)</MenuItem>
                                <MenuItem value=">">より大きい (&gt;)</MenuItem>
                                <MenuItem value="<">より小さい (&lt;)</MenuItem>
                                <MenuItem value=">=">以上 (≥)</MenuItem>
                                <MenuItem value="<=">以下 (≤)</MenuItem>
                                <MenuItem value="contains">含む</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            label="比較値"
                            value={conditionValue}
                            onChange={(e) => setConditionValue(e.target.value)}
                            fullWidth
                            placeholder="例: 100000, はい"
                        />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom>出力ラベル</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            label="条件一致時 (右)"
                            value={yesLabel}
                            onChange={(e) => setYesLabel(e.target.value)}
                            size="small"
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label="条件不一致時 (下)"
                            value={noLabel}
                            onChange={(e) => setNoLabel(e.target.value)}
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
