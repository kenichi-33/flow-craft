'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Paper, Typography, Grid, IconButton, Alert,
    FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
    Checkbox, Select, MenuItem, InputLabel, FormGroup, Chip, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactGridLayout, useContainerWidth } from 'react-grid-layout';
import { api } from '@/lib/api';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ToolboxItem from '@/components/form-designer/ToolboxItem';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';
import FieldSettingsDialog from '@/components/form-designer/FieldSettingsDialog';
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
    required?: boolean;
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



// Custom styled components
const inputStyle = {
    '& .MuiInputBase-root': {
        bgcolor: '#f8f9fa',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
            bgcolor: '#fff',
            borderColor: '#bkc',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        },
        '&.Mui-focused': {
            bgcolor: '#fff',
            borderColor: '#3a1c71',
            boxShadow: '0 0 0 3px rgba(58, 28, 113, 0.1)',
        }
    },
    '& .MuiInputBase-input': {
        padding: '12px 16px',
    },
    '& .MuiInputLabel-root': {
        transform: 'translate(14px, 12px) scale(1)',
        '&.Mui-focused, &.MuiFormLabel-filled': {
            transform: 'translate(14px, -9px) scale(0.75)',
            fontWeight: 'bold',
            color: '#3a1c71',
        }
    }
};

const selectionCardStyle = {
    flex: 1,
    minWidth: '150px',
    m: 0.5,
    p: 1.5,
    borderRadius: 3,
    border: '1px solid #edf2f7',
    transition: 'all 0.2s',
    bgcolor: '#f8f9fa',
    '&:hover': {
        bgcolor: '#fff',
        borderColor: '#cbd5e0',
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    },
    '&:has(.Mui-checked)': {
        bgcolor: '#f0f5ff',
        borderColor: '#3a1c71',
        boxShadow: '0 4px 12px rgba(58, 28, 113, 0.1)'
    }
};

// WYSIWYG Preview Component
// WYSIWYG Preview Component
function FieldPreview({ field, onUpdateLabel, onDelete, onUpdateOptions, onUpdateId, existingIds, onUpdateRequired }: {
    field: FormField;
    onUpdateLabel: (label: string) => void;
    onDelete: () => void;
    onUpdateOptions: (options: string[]) => void;
    onUpdateId: (newId: string) => void;
    onUpdateRequired: (required: boolean) => void;
    existingIds: string[];
}) {
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Get icon based on type
    const getIcon = () => {
        const item = TOOLBOX_ITEMS.find(i => i.type === field.type);
        return item ? item.icon : <TextIcon />;
    };

    const handleSettingsSave = (id: string, updates: Partial<FormField>) => {
        if (updates.label !== undefined) onUpdateLabel(updates.label);
        if (updates.id !== undefined && updates.id !== field.id) onUpdateId(updates.id);
        if (updates.options !== undefined) onUpdateOptions(updates.options);
        if (updates.required !== undefined) onUpdateRequired(updates.required);
    };

    const renderPreview = () => {
        // Reduced preview - minimal interactivity here, focusing on layout
        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
                return (
                    <TextField
                        fullWidth
                        disabled
                        size="small"
                        placeholder={field.label}
                        InputProps={{ disableUnderline: true }}
                        sx={inputStyle}
                    />
                );
            case 'textarea':
                return (
                    <TextField
                        fullWidth
                        disabled
                        multiline
                        rows={2}
                        placeholder={field.label}
                        InputProps={{ disableUnderline: true }}
                        sx={inputStyle}
                    />
                );
            case 'select':
                return (
                    <Select
                        fullWidth
                        disabled
                        size="small"
                        value=""
                        displayEmpty
                        disableUnderline
                        sx={inputStyle}
                    >
                        <MenuItem value="">{field.label}</MenuItem>
                    </Select>
                );
            case 'radio':
            case 'checkbox':
                return (
                    <Box sx={{ p: 1, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                        <Typography variant="caption" color="text.secondary">選択肢プレビュー...</Typography>
                    </Box>
                );
            case 'divider':
                 return <Divider sx={{ borderColor: '#333', borderBottomWidth: 2, my: 1 }} />;
            case 'label':
                return <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{field.label}</Typography>
            default:
                return null;
        }
    };

    if (field.type === 'divider') {
        return (
            <Paper
                elevation={0}
                sx={{
                    p: 1,
                    height: '100%',
                    bgcolor: 'transparent',
                    border: '1px dashed #ccc',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    '&:hover .actions': { opacity: 1 }
                }}
            >
                <Box sx={{ width: '100%' }}><Divider sx={{ borderColor: '#333', borderBottomWidth: 2 }} /></Box>
                 <Box className="actions" sx={{ position: 'absolute', right: 8, top: -12, opacity: 0, transition: 'opacity 0.2s', bgcolor: 'white', border: '1px solid #ddd', borderRadius: 4, display: 'flex' }}>
                    <IconButton size="small" onClick={onDelete} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </Box>
            </Paper>
        );
    }

    return (
        <>
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    height: '100%',
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                        transform: 'translateY(-2px)',
                        '& .field-actions': { opacity: 1 }
                    },
                }}
            >
                {/* Simplified Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box sx={{ color: 'primary.main', display: 'flex' }}>{getIcon()}</Box>
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>{field.label}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {field.type} <span style={{ opacity: 0.5 }}>|</span> ID: {field.id}
                            {field.required && <Chip label="必須" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem' }} />}
                        </Typography>
                    </Box>
                </Box>

                {/* Simplified Content Preview */}
                <Box sx={{ flex: 1, pointerEvents: 'none', opacity: 0.7 }}>
                    {renderPreview()}
                </Box>

                {/* Floating Actions */}
                <Box 
                    className="field-actions" 
                    sx={{ 
                        position: 'absolute', 
                        top: 8, 
                        right: 8, 
                        opacity: 0, 
                        transition: 'opacity 0.2s',
                        display: 'flex',
                        gap: 0.5,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        boxShadow: 1
                    }}
                >
                    <IconButton
                        size="small"
                        onClick={() => setSettingsOpen(true)}
                        color="primary"
                        sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
                    >
                        <SettingsIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        color="error"
                        sx={{ bgcolor: 'error.50', '&:hover': { bgcolor: 'error.100' } }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Paper>

            <FieldSettingsDialog 
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onSave={handleSettingsSave}
                field={field}
                existingIds={existingIds}
            />
        </>
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
    const [previewOpen, setPreviewOpen] = useState(false);

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
                required: (schema.required || []).includes(id)
            }));
            setFields(existingFields);
            setLayout(schema['x-layout'] || []);

            // 既存のfield_N形式のIDから最大番号を取得してカウンター初期化
            const maxFieldNum = Object.keys(props).reduce((max, id) => {
                const match = id.match(/^field_(\d+)/);
                if (match) {
                    return Math.max(max, parseInt(match[1], 10));
                }
                return max;
            }, -1);
            setCounter(maxFieldNum + 1);
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
                // タイムスタンプを含めて一意性を確保
                const newId = `field_${counter}_${Date.now()}`;
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

    const handleUpdateFieldId = (oldId: string, newId: string) => {
        // Update fields array
        setFields(fields.map(f => f.id === oldId ? { ...f, id: newId } : f));
        // Update layout to use new ID
        setLayout(layout.map((l: any) => l.i === oldId ? { ...l, i: newId } : l));
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
            "x-layout": layout,
            required: fields.filter(f => f.required).map(f => f.id)
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
                    <Paper sx={{ 
                        p: 3, 
                        minHeight: 600, 
                        bgcolor: '#fafafa',
                        backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                        borderRadius: 3,
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.02)'
                    }}>
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
                                    style={{ 
                                        minHeight: '500px', 
                                        background: 'transparent', // Transparent to show dots
                                        borderRadius: 8 
                                    }}
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
                                                onUpdateId={(newId) => handleUpdateFieldId(field.id, newId)}
                                                onUpdateRequired={(required) => handleUpdateField(field.id, { required })}
                                                existingIds={fields.map(f => f.id)}
                                            />
                                        </div>
                                    ))}
                                </ReactGridLayout>
                            )}
                        </div>
                    </Paper>
                </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={() => setPreviewOpen(true)}
                    size="large"
                >
                    プレビュー
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending} size="large">
                    {saveMutation.isPending ? '保存中...' : 'フォームを保存'}
                </Button>
            </Box>

            {/* プレビューモーダル */}
            <Dialog
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    申請フォーム プレビュー
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        実際の申請画面と同じ見た目でフォームを確認できます
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ p: 2 }}>
                        {fields.length === 0 ? (
                            <Typography color="text.secondary" textAlign="center">
                                フィールドがまだ追加されていません。<br />
                                ツールボックスからフィールドをドラッグして追加してください。
                            </Typography>
                        ) : (
                            <Box>
                                <DynamicFormRenderer
                                    schema={{
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
                                    }}
                                    onSubmit={(data) => {
                                        alert('プレビューモード: 送信データ\\n' + JSON.stringify(data, null, 2));
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
