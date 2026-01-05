'use client';

import React, { useState, useEffect } from 'react';
import {
    Box,
    TextField,
    Typography,
    Switch,
    FormControlLabel,
    Divider,
    Paper,
    IconButton,
    Button,
    Grid
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface Option {
    label: string;
    value: string;
}

interface FormField {
    id: string;
    type: string;
    label: string;
    options?: Option[] | string[];
    required?: boolean;
    readOnly?: boolean;
    includeTime?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'center' | 'bottom';
}

interface PropertyPanelProps {
    field: FormField | null;
    onUpdate: (fieldId: string, updates: Partial<FormField>) => void;
    existingIds: string[];
}

export default function PropertyPanel({ field, onUpdate, existingIds }: PropertyPanelProps) {
    if (!field) {
        return (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">
                    キャンバス上のフィールドを選択すると<br />プロパティ設定が表示されます
                </Typography>
            </Box>
        );
    }

    // Local state for immediate feedback, synced with field prop
    const [label, setLabel] = useState(field.label);
    const [id, setId] = useState(field.id);
    const [idError, setIdError] = useState<string | null>(null);

    useEffect(() => {
        setLabel(field.label);
        setId(field.id);
        setIdError(null);
    }, [field]);

    // Handle string[] -> Option[] conversion for backward compatibility
    const getOptions = (): Option[] => {
        if (!field.options) return [];
        if (typeof field.options[0] === 'string') {
            return (field.options as string[]).map(s => ({ label: s, value: s }));
        }
        return field.options as Option[];
    };

    const options = getOptions();

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newId = e.target.value;
        setId(newId);
        
        if (!newId.trim()) {
            setIdError('IDは必須です');
            return;
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newId)) {
            setIdError('英数字とアンダースコアのみ使用可能です');
            return;
        }
        if (newId !== field.id && existingIds.includes(newId)) {
            setIdError('このIDは既に使用されています');
            return;
        }
        
        setIdError(null);
        onUpdate(field.id, { id: newId });
    };

    const handleOptionChange = (index: number, key: 'label' | 'value', val: string) => {
        const newOptions = [...options];
        newOptions[index] = { ...newOptions[index], [key]: val };
        onUpdate(field.id, { options: newOptions });
    };

    const addOption = () => {
        const newOptions = [...options, { label: `選択肢${options.length + 1}`, value: `option_${options.length + 1}` }];
        onUpdate(field.id, { options: newOptions });
    };

    const removeOption = (index: number) => {
        const newOptions = options.filter((_, i) => i !== index);
        onUpdate(field.id, { options: newOptions });
    };

    return (
        <Box sx={{ p: 2, height: '100%', overflowY: 'auto' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2, pb: 1, borderBottom: '1px solid #eee' }}>
                プロパティ設定
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Visual Settings */}
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>基本設定</Typography>
                    <TextField
                        fullWidth
                        label="ラベル（表示名）"
                        value={label}
                        onChange={(e) => {
                            setLabel(e.target.value);
                            onUpdate(field.id, { label: e.target.value });
                        }}
                        size="small"
                        sx={{ mb: 2 }}
                    />
                    
                    <TextField
                        fullWidth
                        label="フィールドID (英数字)"
                        value={id}
                        onChange={handleIdChange}
                        error={!!idError}
                        helperText={idError || '※英数字とアンダースコアのみ使用可能'}
                        size="small"
                    />
                </Box>

                <Divider />

                {/* Behavioral Settings */}
                <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>動作設定</Typography>
                    
                    {/* ReadOnly (All Input Types) */}
                    {!['divider', 'label', 'group'].includes(field.type) && (
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={field.readOnly || false}
                                    onChange={(e) => onUpdate(field.id, { readOnly: e.target.checked })}
                                    size="small"
                                />
                            }
                            label="読取専用 (Read Only)"
                        />
                    )}

                    {/* Required (Inputs) */}
                    {!['divider', 'label', 'group', 'checkbox'].includes(field.type) && (
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={field.required || false}
                                    onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
                                    size="small"
                                />
                            }
                            label="必須項目"
                        />
                    )}

                    {/* Date Time Setting */}
                    {field.type === 'date' && (
                         <FormControlLabel
                            control={
                                <Switch
                                    checked={field.includeTime || false}
                                    onChange={(e) => onUpdate(field.id, { includeTime: e.target.checked })}
                                    size="small"
                                />
                            }
                            label="時間入力を含める"
                        />
                    )}

                    {/* Heading Alignment Options */}
                    {field.type === 'label' && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>配置設定</Typography>
                            <Grid container spacing={1}>
                                <Grid size={6}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="水平配置"
                                        value={field.textAlign || 'left'}
                                        onChange={(e) => onUpdate(field.id, { textAlign: e.target.value as 'left' | 'center' | 'right' })}
                                        size="small"
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="left">左寄せ</option>
                                        <option value="center">中央</option>
                                        <option value="right">右寄せ</option>
                                    </TextField>
                                </Grid>
                                <Grid size={6}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="垂直配置"
                                        value={field.verticalAlign || 'center'}
                                        onChange={(e) => onUpdate(field.id, { verticalAlign: e.target.value as 'top' | 'center' | 'bottom' })}
                                        size="small"
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="top">上寄せ</option>
                                        <option value="center">中央</option>
                                        <option value="bottom">下寄せ</option>
                                    </TextField>
                                </Grid>
                            </Grid>
                        </Box>
                    )}
                </Box>

                {/* Options Editor */}
                {['select', 'radio', 'checkbox'].includes(field.type) && (
                    <>
                        <Divider />
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">選択肢設定</Typography>
                                <Button 
                                    size="small" 
                                    startIcon={<AddIcon />} 
                                    onClick={addOption}
                                    sx={{ fontSize: '0.7rem' }}
                                >
                                    追加
                                </Button>
                            </Box>
                            
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {options.map((opt, i) => (
                                    <Paper key={i} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ flex: 1 }}>
                                            <TextField
                                                fullWidth
                                                label="表示名"
                                                value={opt.label}
                                                onChange={(e) => handleOptionChange(i, 'label', e.target.value)}
                                                size="small"
                                                variant="standard"
                                                InputProps={{ style: { fontSize: '0.8rem' } }}
                                                InputLabelProps={{ style: { fontSize: '0.8rem' } }}
                                            />
                                            <TextField
                                                fullWidth
                                                label="値 (Value)"
                                                value={opt.value}
                                                onChange={(e) => handleOptionChange(i, 'value', e.target.value)}
                                                size="small"
                                                variant="standard"
                                                InputProps={{ style: { fontSize: '0.8rem', color: '#666' } }}
                                                InputLabelProps={{ style: { fontSize: '0.8rem' } }}
                                                sx={{ mt: 0.5 }}
                                            />
                                        </Box>
                                        <IconButton size="small" onClick={() => removeOption(i)} color="default">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    </>
                )}
            </Box>
        </Box>
    );
}
