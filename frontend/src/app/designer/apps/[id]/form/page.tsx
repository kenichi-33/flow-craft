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
function FieldPreview({ field, onUpdateLabel, onDelete, onUpdateOptions, onUpdateId, existingIds }: {
    field: FormField;
    onUpdateLabel: (label: string) => void;
    onDelete: () => void;
    onUpdateOptions: (options: string[]) => void;
    onUpdateId: (newId: string) => void;
    existingIds: string[];
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingId, setIsEditingId] = useState(false);
    const [labelValue, setLabelValue] = useState(field.label);
    const [idValue, setIdValue] = useState(field.id);
    const [idError, setIdError] = useState<string | null>(null);
    const [optionsText, setOptionsText] = useState((field.options || []).join(', '));
    const sampleOptions = field.options && field.options.length > 0
        ? field.options
        : ['選択肢1', '選択肢2', '選択肢3'];

    // Sync label value when field.label changes
    useEffect(() => {
        setLabelValue(field.label);
    }, [field.label]);

    // Sync id value when field.id changes
    useEffect(() => {
        setIdValue(field.id);
    }, [field.id]);

    const validateId = (newId: string): string | null => {
        if (!newId.trim()) return 'IDは必須です';
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newId)) return 'IDは英数字とアンダースコアのみ（先頭は英字または_）';
        if (newId !== field.id && existingIds.includes(newId)) return 'このIDは既に使用されています';
        return null;
    };

    const handleIdChange = (newId: string) => {
        setIdValue(newId);
        setIdError(validateId(newId));
    };

    const handleIdSave = () => {
        const error = validateId(idValue);
        if (error) {
            setIdError(error);
            return;
        }
        onUpdateId(idValue);
        setIsEditingId(false);
        setIdError(null);
    };

    const handleIdCancel = () => {
        setIdValue(field.id);
        setIsEditingId(false);
        setIdError(null);
    };

    const handleSaveOptions = () => {
        const newOptions = optionsText.split(',').map(s => s.trim()).filter(s => s);
        onUpdateOptions(newOptions);
        setIsEditing(false);
    };

    const handleLabelChange = (newLabel: string) => {
        setLabelValue(newLabel);
        onUpdateLabel(newLabel);
    };

    // Render editable ID chip
    const renderIdChip = () => {
        if (isEditingId) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pointerEvents: 'auto' }} onMouseDown={e => e.stopPropagation()}>
                    <TextField
                        size="small"
                        value={idValue}
                        onChange={(e) => handleIdChange(e.target.value)}
                        error={!!idError}
                        helperText={idError}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleIdSave();
                            if (e.key === 'Escape') handleIdCancel();
                        }}
                        sx={{
                            width: 150,
                            '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, px: 1 },
                            '& .MuiFormHelperText-root': { fontSize: '0.6rem', mt: 0.25 }
                        }}
                    />
                    <Button size="small" onClick={handleIdSave} sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.7rem' }}>
                        保存
                    </Button>
                    <Button size="small" onClick={handleIdCancel} sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.7rem' }}>
                        ×
                    </Button>
                </Box>
            );
        }
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pointerEvents: 'auto' }}>
                <Chip
                    label={`ID: ${field.id}`}
                    size="small"
                    sx={{
                        height: 20,
                        fontSize: '0.625rem',
                        bgcolor: 'grey.100',
                        color: 'text.secondary',
                    }}
                />
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsEditingId(true);
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    sx={{
                        p: 0.25,
                        '&:hover': { bgcolor: 'primary.light', color: 'white' }
                    }}
                >
                    <EditIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Box>
        );
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
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
                                {field.label || '見出しテキスト'}
                            </Typography>
                            {renderIdChip()}
                        </Box>
                    </Box>
                );

            case 'text':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <TextField
                            fullWidth
                            disabled
                            size="small"
                            placeholder="テキストを入力"
                            sx={{ bgcolor: 'white' }}
                        />
                    </Box>
                );

            case 'textarea':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <TextField
                            fullWidth
                            disabled
                            multiline
                            rows={3}
                            placeholder="長文テキストを入力"
                            sx={{ bgcolor: 'white' }}
                        />
                    </Box>
                );

            case 'number':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <TextField
                            type="number"
                            fullWidth
                            disabled
                            size="small"
                            placeholder="0"
                            sx={{ bgcolor: 'white' }}
                        />
                    </Box>
                );

            case 'select':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <Select
                            fullWidth
                            disabled
                            size="small"
                            value=""
                            displayEmpty
                            sx={{ bgcolor: 'white' }}
                        >
                            <MenuItem value="">選択してください</MenuItem>
                            {sampleOptions.map((opt, i) => (
                                <MenuItem key={i} value={opt}>{opt}</MenuItem>
                            ))}
                        </Select>
                    </Box>
                );

            case 'radio':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <RadioGroup row>
                            {sampleOptions.map((opt, i) => (
                                <FormControlLabel
                                    key={i}
                                    value={opt}
                                    control={<Radio size="small" disabled />}
                                    label={opt}
                                />
                            ))}
                        </RadioGroup>
                    </Box>
                );

            case 'checkbox':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <FormGroup row>
                            {sampleOptions.map((opt, i) => (
                                <FormControlLabel
                                    key={i}
                                    control={<Checkbox size="small" disabled />}
                                    label={opt}
                                />
                            ))}
                        </FormGroup>
                    </Box>
                );

            case 'date':
                return (
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}>
                            <FormLabel>{field.label}</FormLabel>
                            {renderIdChip()}
                        </Box>
                        <TextField
                            type="date"
                            fullWidth
                            disabled
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            sx={{ bgcolor: 'white' }}
                        />
                    </Box>
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
                                                onUpdateId={(newId) => handleUpdateFieldId(field.id, newId)}
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
                                {/* レイアウト順にソートしてフィールドを表示 */}
                                {[...layout]
                                    .sort((a, b) => (a.y * 100 + a.x) - (b.y * 100 + b.x))
                                    .map((layoutItem) => {
                                        const field = fields.find(f => f.id === layoutItem.i);
                                        if (!field) return null;
                                        const isHalfWidth = layoutItem.w <= 6;
                                        return (
                                            <Box
                                                key={field.id}
                                                sx={{
                                                    mb: 2,
                                                    display: isHalfWidth ? 'inline-block' : 'block',
                                                    width: isHalfWidth ? '48%' : '100%',
                                                    mr: isHalfWidth ? '2%' : 0,
                                                    verticalAlign: 'top',
                                                }}
                                            >
                                                {field.type === 'divider' && <Divider sx={{ my: 2 }} />}
                                                {field.type === 'label' && (
                                                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                        {field.label}
                                                    </Typography>
                                                )}
                                                {field.type === 'text' && (
                                                    <TextField fullWidth label={field.label} size="small" />
                                                )}
                                                {field.type === 'textarea' && (
                                                    <TextField fullWidth label={field.label} multiline rows={3} />
                                                )}
                                                {field.type === 'number' && (
                                                    <TextField fullWidth label={field.label} type="number" size="small" />
                                                )}
                                                {field.type === 'date' && (
                                                    <TextField fullWidth label={field.label} type="date" InputLabelProps={{ shrink: true }} size="small" />
                                                )}
                                                {field.type === 'select' && (
                                                    <TextField select fullWidth label={field.label} size="small" defaultValue="">
                                                        {(field.options || []).map(opt => (
                                                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                                        ))}
                                                    </TextField>
                                                )}
                                                {field.type === 'radio' && (
                                                    <FormControl component="fieldset">
                                                        <FormLabel>{field.label}</FormLabel>
                                                        <RadioGroup row>
                                                            {(field.options || []).map(opt => (
                                                                <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
                                                            ))}
                                                        </RadioGroup>
                                                    </FormControl>
                                                )}
                                                {field.type === 'checkbox' && (
                                                    <FormControl component="fieldset">
                                                        <FormLabel>{field.label}</FormLabel>
                                                        <FormGroup row>
                                                            {(field.options || []).map(opt => (
                                                                <FormControlLabel key={opt} control={<Checkbox />} label={opt} />
                                                            ))}
                                                        </FormGroup>
                                                    </FormControl>
                                                )}
                                            </Box>
                                        );
                                    })}
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
