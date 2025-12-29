'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Paper, Typography, Grid, IconButton, Alert,
    FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
    Checkbox, Select, MenuItem, InputLabel, FormGroup, Chip, Divider
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactGridLayout, useContainerWidth } from 'react-grid-layout';
import { api } from '@/lib/api';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ToolboxItem from '@/components/form-designer/ToolboxItem';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import NumbersIcon from '@mui/icons-material/Numbers';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import TextIcon from '@mui/icons-material/Notes';
import ListIcon from '@mui/icons-material/List';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import TitleIcon from '@mui/icons-material/Title';
import Link from 'next/link';

interface FormField {
    id: string;
    type: 'text' | 'number' | 'checkbox' | 'textarea' | 'select' | 'radio' | 'date' | 'divider' | 'label';
    label: string;
    options?: string[];
}

const TOOLBOX_ITEMS = [
    { type: 'text', label: 'テキスト', icon: <TextFieldsIcon /> },
    { type: 'textarea', label: 'テキストエリア', icon: <TextIcon /> },
    { type: 'number', label: '数値', icon: <NumbersIcon /> },
    { type: 'select', label: 'セレクト', icon: <ListIcon /> },
    { type: 'radio', label: 'ラジオ', icon: <RadioButtonCheckedIcon /> },
    { type: 'checkbox', label: 'チェックボックス', icon: <CheckBoxIcon /> },
    { type: 'date', label: '日付', icon: <CalendarTodayIcon /> },
    { type: 'divider', label: '区切り線', icon: <HorizontalRuleIcon /> },
    { type: 'label', label: '見出し', icon: <TitleIcon /> },
];

// WYSIWYG Preview Component
function FieldPreview({ field, onUpdateLabel, onDelete, onUpdateOptions }: {
    field: FormField;
    onUpdateLabel: (label: string) => void;
    onDelete: () => void;
    onUpdateOptions: (options: string[]) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [labelValue, setLabelValue] = useState(field.label);
    const [optionsText, setOptionsText] = useState((field.options || []).join(', '));
    const sampleOptions = field.options && field.options.length > 0
        ? field.options
        : ['選択肢1', '選択肢2', '選択肢3'];

    // Sync label value when field.label changes
    useEffect(() => {
        setLabelValue(field.label);
    }, [field.label]);

    const handleSaveOptions = () => {
        const newOptions = optionsText.split(',').map(s => s.trim()).filter(s => s);
        onUpdateOptions(newOptions);
        setIsEditing(false);
    };

    const handleLabelChange = (newLabel: string) => {
        setLabelValue(newLabel);
        onUpdateLabel(newLabel);
    };

    const renderPreview = () => {
        switch (field.type) {
            case 'divider':
                return (
                    <Box sx={{ py: 1 }}>
                        <Divider sx={{ borderColor: '#333', borderBottomWidth: 2 }} />
                    </Box>
                );

            case 'label':
                return (
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                        {field.label || '見出しテキスト'}
                    </Typography>
                );

            case 'text':
                return (
                    <TextField
                        label={field.label}
                        placeholder="テキストを入力"
                        fullWidth
                        size="small"
                        disabled
                        sx={{ bgcolor: 'white' }}
                    />
                );

            case 'textarea':
                return (
                    <TextField
                        label={field.label}
                        placeholder="長文テキストを入力"
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        disabled
                        sx={{ bgcolor: 'white' }}
                    />
                );

            case 'number':
                return (
                    <TextField
                        label={field.label}
                        type="number"
                        placeholder="0"
                        fullWidth
                        size="small"
                        disabled
                        sx={{ bgcolor: 'white' }}
                    />
                );

            case 'date':
                return (
                    <TextField
                        label={field.label}
                        type="date"
                        fullWidth
                        size="small"
                        disabled
                        InputLabelProps={{ shrink: true }}
                        sx={{ bgcolor: 'white' }}
                    />
                );

            case 'select':
                return (
                    <FormControl fullWidth size="small" disabled>
                        <InputLabel>{field.label}</InputLabel>
                        <Select label={field.label} value="" sx={{ bgcolor: 'white' }}>
                            {sampleOptions.map((opt) => (
                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );

            case 'radio':
                return (
                    <FormControl component="fieldset">
                        <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>{field.label}</FormLabel>
                        <RadioGroup row>
                            {sampleOptions.map((opt) => (
                                <FormControlLabel
                                    key={opt}
                                    value={opt}
                                    control={<Radio size="small" disabled />}
                                    label={opt}
                                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                );

            case 'checkbox':
                return (
                    <FormControl component="fieldset">
                        <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>{field.label}</FormLabel>
                        <FormGroup row>
                            {sampleOptions.map((opt) => (
                                <FormControlLabel
                                    key={opt}
                                    control={<Checkbox size="small" disabled />}
                                    label={opt}
                                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                                />
                            ))}
                        </FormGroup>
                    </FormControl>
                );

            default:
                return <Typography>Unknown field type</Typography>;
        }
    };

    // Special rendering for divider - minimal UI
    if (field.type === 'divider') {
        return (
            <Paper
                elevation={1}
                sx={{
                    p: 1,
                    height: '100%',
                    bgcolor: '#fafafa',
                    border: '1px dashed #ccc',
                    borderRadius: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                }}
            >
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        onMouseDown={(e) => e.stopPropagation()}
                        color="error"
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
                {renderPreview()}
            </Paper>
        );
    }

    return (
        <Paper
            elevation={2}
            sx={{
                p: 2,
                height: '100%',
                bgcolor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                position: 'relative',
                overflow: 'auto',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 3,
                },
            }}
        >
            {/* Header with actions */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
            }}>
                <Chip
                    label={field.type}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                />
                <Box>
                    {['select', 'radio', 'checkbox'].includes(field.type) && (
                        <IconButton
                            size="small"
                            onClick={() => setIsEditing(!isEditing)}
                            onMouseDown={(e) => e.stopPropagation()}
                            color="primary"
                        >
                            <SettingsIcon fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        onMouseDown={(e) => e.stopPropagation()}
                        color="error"
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            {/* Field Preview */}
            <Box sx={{ pointerEvents: 'none', mb: 1 }}>
                {renderPreview()}
            </Box>

            {/* Label editor - always visible for most field types */}
            {!['divider'].includes(field.type) && (
                <TextField
                    size="small"
                    fullWidth
                    value={labelValue}
                    label="ラベル"
                    sx={{ mt: 1, bgcolor: 'white' }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleLabelChange(e.target.value)}
                />
            )}

            {/* Options Editor for select/radio/checkbox */}
            {isEditing && ['select', 'radio', 'checkbox'].includes(field.type) && (
                <Box
                    sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed #ccc' }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <TextField
                        label="選択肢（カンマ区切り）"
                        value={optionsText}
                        onChange={(e) => setOptionsText(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="選択肢1, 選択肢2, 選択肢3"
                        helperText="Enterで保存"
                        sx={{ bgcolor: 'white' }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveOptions();
                            }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                    <Button
                        size="small"
                        onClick={handleSaveOptions}
                        sx={{ mt: 1 }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        保存
                    </Button>
                </Box>
            )}
        </Paper>
    );
}

export default function AppFormEditorPage() {
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const appId = params.id as string;

    const [formName, setFormName] = useState('');
    const [fields, setFields] = useState<FormField[]>([]);
    const [layout, setLayout] = useState<any[]>([]);
    const [counter, setCounter] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { width, containerRef, mounted } = useContainerWidth({
        measureBeforeMount: false,
        initialWidth: 800,
    });

    // Get app details
    const { data: app } = useQuery({
        queryKey: ['apps', appId],
        queryFn: () => api.get(`/application-definitions/${appId}`),
        enabled: !!appId,
    });

    // Load existing form if any
    useEffect(() => {
        if ((app as any)?.formDefinition) {
            setFormName((app as any).formDefinition.name || '');
            const schema = (app as any).formDefinition.schema || {};
            const props = schema.properties || {};
            const existingFields = Object.entries(props).map(([id, prop]: [string, any]) => ({
                id,
                type: prop.type || 'text',
                label: prop.title || id,
                options: prop.options,
            }));
            setFields(existingFields);
            setLayout(schema['x-layout'] || []);
            setCounter(existingFields.length);
        } else if (app) {
            setFormName(`${(app as any).name}フォーム`);
        }
    }, [app]);

    const saveMutation = useMutation({
        mutationFn: async (formData: { name: string; schema: any }) => {
            let formDefId = (app as any)?.formDefinitionId;

            if (formDefId) {
                await api.put(`/forms/${formDefId}`, formData);
            } else {
                const newForm = await api.post('/forms', formData) as any;
                formDefId = newForm.id;
                await api.put(`/application-definitions/${appId}`, { formDefinitionId: formDefId });
            }
            return formDefId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apps', appId] });
            setSuccess('フォームを保存しました');
            setTimeout(() => setSuccess(null), 3000);
        },
        onError: (err: any) => {
            setError(err.message || '保存に失敗しました');
        },
    });

    const onDrop = (layoutArr: any, layoutItem: any, event: Event) => {
        const dragEvent = event as DragEvent;
        try {
            const data = dragEvent.dataTransfer?.getData('text/plain');
            if (data) {
                const { type, label } = JSON.parse(data);
                const newId = `field_${counter}`;
                setCounter(c => c + 1);

                const defaultOptions = ['select', 'radio', 'checkbox'].includes(type)
                    ? ['選択肢1', '選択肢2', '選択肢3']
                    : undefined;

                setFields(prev => [...prev, { id: newId, type, label, options: defaultOptions }]);

                const droppedItem = layoutArr.find((l: any) => l.i === '__dropping_elem__');
                // Different heights for different types
                let newHeight = 2;
                let newWidth = 6; // Default half width (allows 2 per row)

                if (['textarea', 'radio', 'checkbox'].includes(type)) {
                    newHeight = 3;
                }
                if (type === 'divider') {
                    newHeight = 1;
                    newWidth = 12; // Full width for divider
                }
                if (type === 'label') {
                    newHeight = 1;
                    newWidth = 12; // Full width for label
                }

                setLayout(prev => [...prev, {
                    i: newId,
                    x: droppedItem?.x ?? 0,
                    y: droppedItem?.y ?? 0,
                    w: newWidth,
                    h: newHeight
                }]);
            }
        } catch (e) {
            console.error("Failed to parse drop data", e);
        }
    };

    const handleLayoutChange = (newLayout: any[]) => {
        setLayout(newLayout);
    };

    const handleRemoveField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
        setLayout(layout.filter((l: any) => l.i !== id));
    };

    const handleUpdateField = (id: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleSave = () => {
        if (!formName.trim()) {
            setError('フォーム名を入力してください');
            return;
        }
        setError(null);

        const schema = {
            type: 'object',
            properties: fields.reduce((acc, field) => ({
                ...acc,
                [field.id]: {
                    type: field.type,
                    title: field.label,
                    options: field.options
                }
            }), {}),
            "x-layout": layout
        };

        saveMutation.mutate({ name: formName, schema });
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href={`/designer/apps/${appId}`}>
                    アプリに戻る
                </Button>
                <Typography variant="h5">フォーム編集: {(app as any)?.name}</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <TextField
                label="フォーム名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                fullWidth
                sx={{ mb: 2, maxWidth: 400 }}
            />

            <Grid container spacing={2}>
                <Grid size={3}>
                    <Paper sx={{ p: 2, position: 'sticky', top: 80 }}>
                        <Typography variant="h6" gutterBottom>ツールボックス</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                            ドラッグしてキャンバスにドロップ。横並びも可能。
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        {TOOLBOX_ITEMS.map((item) => (
                            <ToolboxItem key={item.type} type={item.type} label={item.label} icon={item.icon} />
                        ))}
                    </Paper>
                </Grid>

                <Grid size={9}>
                    <Paper sx={{ p: 2, minHeight: 600, bgcolor: '#f5f5f5' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">プレビューキャンバス</Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Chip label={`${fields.length} フィールド`} size="small" />
                                <Chip label="12列グリッド" size="small" variant="outlined" />
                            </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                            ドラッグで移動、角をドラッグでリサイズ。幅を半分にすると横並びに配置できます。
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <div ref={containerRef} style={{ width: '100%' }}>
                            {mounted && (
                                <ReactGridLayout
                                    className="layout"
                                    style={{ minHeight: '500px', background: 'white', borderRadius: 8 }}
                                    layout={layout}
                                    gridConfig={{ cols: 12, rowHeight: 80 }}
                                    width={width}
                                    onDrop={onDrop}
                                    onDragStop={(newLayout: any) => setLayout(newLayout)}
                                    onResizeStop={(newLayout: any) => setLayout(newLayout)}
                                    dropConfig={{ enabled: true, defaultItem: { w: 6, h: 2 } }}
                                    dragConfig={{ enabled: true }}
                                    resizeConfig={{ enabled: true }}
                                    droppingItem={{ i: "__dropping_elem__", x: 0, y: 0, w: 6, h: 2 }}
                                >
                                    {fields.map((field) => (
                                        <div key={field.id}>
                                            <FieldPreview
                                                field={field}
                                                onUpdateLabel={(label) => handleUpdateField(field.id, { label })}
                                                onDelete={() => handleRemoveField(field.id)}
                                                onUpdateOptions={(options) => handleUpdateField(field.id, { options })}
                                            />
                                        </div>
                                    ))}
                                </ReactGridLayout>
                            )}
                        </div>
                    </Paper>
                </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending} size="large">
                    {saveMutation.isPending ? '保存中...' : 'フォームを保存'}
                </Button>
            </Box>
        </Box>
    );
}
