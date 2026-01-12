'use client';

import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Button, Select, MenuItem, FormControl, InputLabel,
    Divider, Grid, Tabs, Tab, Chip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import HttpIcon from '@mui/icons-material/Http';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';

// Key-Value Editor Component
const KeyValueEditor = ({ value, onChange, placeholderKey, placeholderValue, disabled = false }: any) => {
    const [rows, setRows] = useState<{ key: string, value: string }[]>([]);

    useEffect(() => {
        try {
            if (!value) {
                setRows([]);
                return;
            }
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            const newRows = Object.entries(parsed).map(([key, val]) => ({
                key,
                value: String(val)
            }));
            setRows(newRows);
        } catch (e) {
            // If invalid JSON, ignore or handle? For now, if invalid, we might want to show empty or try best effort
            // If it's a simple string, maybe it's raw body.
            setRows([]);
        }
    }, [value]);

    const updateRow = (index: number, field: 'key' | 'value', val: string) => {
        if (disabled) return;
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: val };
        setRows(newRows);
        emitChange(newRows);
    };

    const addRow = () => {
        if (disabled) return;
        const newRows = [...rows, { key: '', value: '' }];
        setRows(newRows);
        emitChange(newRows);
    };

    const removeRow = (index: number) => {
        if (disabled) return;
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        emitChange(newRows);
    };

    const emitChange = (currentRows: { key: string, value: string }[]) => {
        const obj = currentRows.reduce((acc, row) => {
            if (row.key) acc[row.key] = row.value;
            return acc;
        }, {} as Record<string, string>);
        onChange(JSON.stringify(obj, null, 2));
    };

    return (
        <Box>
            {rows.length === 0 && disabled && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    設定なし
                </Typography>
            )}
            {rows.map((row, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder={placeholderKey || "Key"}
                        value={row.key}
                        onChange={(e) => updateRow(index, 'key', e.target.value)}
                        sx={{ flex: 1 }}
                        disabled={disabled}
                    />
                    <TextField
                        size="small"
                        placeholder={placeholderValue || "Value ({{field}})"}
                        value={row.value}
                        onChange={(e) => updateRow(index, 'value', e.target.value)}
                        sx={{ flex: 1 }}
                        disabled={disabled}
                    />
                    {!disabled && (
                        <IconButton size="small" onClick={() => removeRow(index)} color="error">
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            ))}
            {!disabled && (
                <Button
                    startIcon={<AddCircleIcon />}
                    size="small"
                    onClick={addRow}
                    sx={{ textTransform: 'none' }}
                >
                    項目を追加
                </Button>
            )}
        </Box>
    );
};

interface BodyTabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: BodyTabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ py: 2 }}>{children}</Box>
            )}
        </div>
    );
}

// API Call Node - BPMN Service Task style
export default function APICallNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || 'API呼び出し');
    const [url, setUrl] = useState(data.url || '');
    const [method, setMethod] = useState(data.method || 'GET');
    const [headers, setHeaders] = useState(data.headers || '{}');
    const [body, setBody] = useState(data.body || '{}');
    const [successCodes, setSuccessCodes] = useState(data.successCodes || '200,201,204');
    const [errorBehavior, setErrorBehavior] = useState(data.errorBehavior || 'stop');
    const [responseMapping, setResponseMapping] = useState(data.responseMapping || '{}');
    const [tabValue, setTabValue] = useState(0);

    const { setNodes } = useReactFlow();

    // ReadOnly mode check
    const isReadOnly = data.readOnly === true;

    const handleSave = () => {
        if (isReadOnly) {
            setDialogOpen(false);
            return;
        }
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            label,
                            url,
                            method,
                            headers,
                            body,
                            successCodes,
                            errorBehavior,
                            responseMapping,
                        }
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const parseJson = (str: string) => {
        try {
            return JSON.parse(str);
        } catch {
            return {};
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
                    background: 'linear-gradient(135deg, #7e57c2 0%, #5e35b1 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(94, 53, 177, 0.4)',
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
                        background: '#4527a0',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <HttpIcon sx={{ color: 'white', fontSize: 16 }} />
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'white',
                            fontWeight: 'bold',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}
                    >
                        {data.label || 'API呼び出し'}
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

                {data.url && (
                    <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                        {data.method} {data.url}
                    </Typography>
                )}

                <Handle
                    type="source"
                    position={Position.Right}
                    style={{
                        background: '#4527a0',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />
            </Box>

            {/* Unified Dialog - uses disabled inputs when readOnly */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{isReadOnly ? 'API呼び出し設定 (読取専用)' : 'API呼び出し設定'}</DialogTitle>
                <DialogContent>
                    {/* Form fields help - only show in edit mode */}
                    {!isReadOnly && data.formFields && data.formFields.length > 0 && (
                        <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1, display: 'block' }}>
                                使用可能なフォーム項目 (クリックしてIDをコピー)
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {data.formFields.map((field: any) => (
                                    <Chip
                                        key={field.id}
                                        label={`${field.label} (${field.id})`}
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`{{${field.id}}}`);
                                        }}
                                        sx={{ fontSize: '0.7rem', height: 20 }}
                                    />
                                ))}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.65rem' }}>
                                ※ 値の入力欄で <code>{`{{フィールドID}}`}</code> と記述するとフォームの値が埋め込まれます
                            </Typography>
                        </Box>
                    )}

                    <Grid container spacing={2} sx={{ mt: 0 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="ステップ名"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                fullWidth
                                size="small"
                                disabled={isReadOnly}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 2 }}>
                            <FormControl fullWidth size="small" disabled={isReadOnly}>
                                <InputLabel>メソッド</InputLabel>
                                <Select
                                    value={method}
                                    onChange={(e) => setMethod(e.target.value)}
                                    label="メソッド"
                                >
                                    <MenuItem value="GET">GET</MenuItem>
                                    <MenuItem value="POST">POST</MenuItem>
                                    <MenuItem value="PUT">PUT</MenuItem>
                                    <MenuItem value="DELETE">DELETE</MenuItem>
                                    <MenuItem value="PATCH">PATCH</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                                label="URL"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                fullWidth
                                size="small"
                                placeholder="https://api.example.com/endpoint"
                                disabled={isReadOnly}
                            />
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle2" gutterBottom>ヘッダー設定</Typography>
                    <KeyValueEditor
                        value={headers}
                        onChange={setHeaders}
                        placeholderKey="Header-Name"
                        placeholderValue="Value ({{field}})"
                        disabled={isReadOnly}
                    />

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle2" gutterBottom>リクエストボディ設定</Typography>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={tabValue} onChange={handleTabChange}>
                            <Tab label="キー/値マッピング" />
                            <Tab label="Raw JSON" />
                        </Tabs>
                    </Box>
                    <CustomTabPanel value={tabValue} index={0}>
                        <KeyValueEditor
                            value={body}
                            onChange={setBody}
                            placeholderKey="Field Name"
                            placeholderValue="Value ({{formField}})"
                            disabled={isReadOnly}
                        />
                        {!isReadOnly && (
                            <Typography variant="caption" color="text.secondary">
                                ※ フォームの入力値を埋め込む場合は <code>{`{{フィールドID}}`}</code> と記述してください
                            </Typography>
                        )}
                    </CustomTabPanel>
                    <CustomTabPanel value={tabValue} index={1}>
                        <TextField
                            label="Raw JSON"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            fullWidth
                            multiline
                            rows={6}
                            placeholder='{"key": "{{formField}}"}'
                            disabled={isReadOnly}
                        />
                    </CustomTabPanel>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle2" gutterBottom>レスポンス判定設定</Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="成功ステータスコード"
                                value={successCodes}
                                onChange={(e) => setSuccessCodes(e.target.value)}
                                fullWidth
                                size="small"
                                placeholder="200,201,204"
                                helperText="カンマ区切りで複数指定可"
                                disabled={isReadOnly}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <FormControl fullWidth size="small" disabled={isReadOnly}>
                                <InputLabel>エラー時の動作</InputLabel>
                                <Select
                                    value={errorBehavior}
                                    onChange={(e) => setErrorBehavior(e.target.value)}
                                    label="エラー時の動作"
                                >
                                    <MenuItem value="stop">フローを停止</MenuItem>
                                    <MenuItem value="continue">次のステップへ進む</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    <Divider sx={{ my: 3 }} />

                    <Typography variant="subtitle2" gutterBottom>レスポンスマッピング (JSONパス → フォームID)</Typography>
                    {!isReadOnly && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                            APIレスポンスから値を抽出し、フォーム項目を自動更新します。
                            <br />
                            Key: レスポンスJSONのパス (例: <code>data.user.id</code>)
                            <br />
                            Value: 反映先のフォーム項目ID (例: <code>userId</code>)
                        </Typography>
                    )}
                    <KeyValueEditor
                        value={responseMapping}
                        onChange={setResponseMapping}
                        placeholderKey="Response JSON Path"
                        placeholderValue="Form Field ID"
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
