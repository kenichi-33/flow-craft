'use client';

import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel,
    Divider, Slider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SmartToyIcon from '@mui/icons-material/SmartToy';

// LLM Call Node - AI/ML Service Task style
export default function LLMCallNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'LLM呼び出し');
    const [model, setModel] = useState(data.model || 'gpt-4');
    const [prompt, setPrompt] = useState(data.prompt || '');
    const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
    const [temperature, setTemperature] = useState(data.temperature ?? 0.7);
    const [outputField, setOutputField] = useState(data.outputField || 'llmResponse');
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
                            model,
                            prompt,
                            systemPrompt,
                            temperature,
                            outputField,
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
                    minWidth: 140,
                    minHeight: 60,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #26a69a 0%, #00897b 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0, 137, 123, 0.4)',
                    border: '2px solid rgba(255,255,255,0.5)',
                    position: 'relative',
                    cursor: isReadOnly ? 'pointer' : 'default',
                }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{
                        background: '#00695c',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SmartToyIcon sx={{ color: 'white', fontSize: 16 }} />
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'white',
                            fontWeight: 'bold',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}
                    >
                        {data.label || 'LLM呼び出し'}
                    </Typography>
                    {!isReadOnly && (
                        <IconButton
                            size="small"
                            onClick={() => setDialogOpen(true)}
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={{ color: 'white', p: 0.3 }}
                        >
                            <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    )}
                </Box>

                {data.model && (
                    <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 9 }}
                    >
                        {data.model}
                    </Typography>
                )}

                <Handle
                    type="source"
                    position={Position.Right}
                    style={{
                        background: '#00695c',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />
            </Box>

            {/* Unified Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{isReadOnly ? 'LLM呼び出し設定 (読取専用)' : 'LLM呼び出し設定'}</DialogTitle>
                <DialogContent>
                    <TextField
                        label="ステップ名"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        fullWidth
                        sx={{ mt: 2 }}
                        disabled={isReadOnly}
                    />

                    <FormControl fullWidth sx={{ mt: 2 }} disabled={isReadOnly}>
                        <InputLabel>モデル</InputLabel>
                        <Select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            label="モデル"
                        >
                            <MenuItem value="gpt-4">GPT-4</MenuItem>
                            <MenuItem value="gpt-4-turbo">GPT-4 Turbo</MenuItem>
                            <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                            <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
                            <MenuItem value="claude-3-sonnet">Claude 3 Sonnet</MenuItem>
                            <MenuItem value="gemini-pro">Gemini Pro</MenuItem>
                        </Select>
                    </FormControl>

                    <Divider sx={{ my: 2 }} />

                    <TextField
                        label="システムプロンプト"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="あなたは○○のエキスパートです。"
                        disabled={isReadOnly}
                    />

                    <TextField
                        label="プロンプト"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        sx={{ mt: 2 }}
                        placeholder="{{formField}} の内容を分析してください。"
                        helperText="{{変数名}} でフォームデータを参照可能"
                        disabled={isReadOnly}
                    />

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" gutterBottom>
                            Temperature: {temperature}
                        </Typography>
                        <Slider
                            value={temperature}
                            onChange={(_, v) => setTemperature(v as number)}
                            min={0}
                            max={2}
                            step={0.1}
                            valueLabelDisplay="auto"
                            disabled={isReadOnly}
                        />
                    </Box>

                    <TextField
                        label="出力フィールド名"
                        value={outputField}
                        onChange={(e) => setOutputField(e.target.value)}
                        fullWidth
                        sx={{ mt: 2 }}
                        placeholder="llmResponse"
                        helperText="LLMの応答を保存するフィールド名"
                        disabled={isReadOnly}
                    />
                </DialogContent>
                <DialogActions>
                    {isReadOnly ? (
                        <Button onClick={() => setDialogOpen(false)} variant="contained">閉じる</Button>
                    ) : (
                        <>
                            <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                            <Button variant="contained" onClick={handleSave}>保存</Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
}
