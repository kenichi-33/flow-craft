'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Paper, Typography, Grid, IconButton, Alert,
    Select, MenuItem, Chip, Divider, Radio, RadioGroup, FormControl, FormControlLabel, Checkbox,
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
import PropertyPanel from '@/components/form-designer/PropertyPanel';

import TextFieldsIcon from '@mui/icons-material/TextFields';
import NumbersIcon from '@mui/icons-material/Numbers';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import TextIcon from '@mui/icons-material/Notes';
import ListIcon from '@mui/icons-material/List';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import TitleIcon from '@mui/icons-material/Title';
import Link from 'next/link';

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

import AccountTreeIcon from '@mui/icons-material/AccountTree'; // Using AccountTree or similar for Group/Section

const TOOLBOX_ITEMS = [
    { type: 'text', label: 'テキスト', icon: <TextFieldsIcon /> },
    { type: 'textarea', label: 'テキストエリア', icon: <TextIcon /> },
    { type: 'number', label: '数値', icon: <NumbersIcon /> },
    { type: 'select', label: 'セレクト', icon: <ListIcon /> },
    { type: 'radio', label: 'ラジオ', icon: <RadioButtonCheckedIcon /> },
    { type: 'checkbox', label: 'チェックボックス', icon: <CheckBoxIcon /> },
    { type: 'date', label: '日付', icon: <CalendarTodayIcon /> },
    { type: 'group', label: 'グループ', icon: <AccountTreeIcon /> },
    { type: 'divider', label: '区切り線', icon: <HorizontalRuleIcon /> },
    { type: 'label', label: '見出し', icon: <TitleIcon /> },
];

// Custom styled components
const inputStyle = {
    '& .MuiInputBase-root': {
        bgcolor: '#f8f9fa',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        transition: 'all 0.2s',
        pointerEvents: 'none' // Disable interaction in designer
    },
    '& .MuiInputBase-input': { padding: '10px 14px' }
};

// Simplified Preview Component
function FieldPreview({ field, isSelected, onClick, onDelete }: {
    field: FormField;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}) {
    // Get icon based on type
    const getIcon = () => {
        const item = TOOLBOX_ITEMS.find(i => i.type === field.type);
        return item ? item.icon : <TextIcon />;
    };

    const renderPreview = () => {
        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
                return (
                    <TextField
                        fullWidth
                        disabled
                        variant="standard"
                        size="small"
                        placeholder={field.type === 'date' && field.includeTime ? 'YYYY/MM/DD HH:mm' : field.label}
                        InputProps={{ disableUnderline: true }}
                        sx={inputStyle}
                    />
                );
            case 'textarea':
                return (
                    <TextField
                        fullWidth
                        disabled
                        variant="standard"
                        multiline
                        rows={2}
                        placeholder={field.label}
                        InputProps={{ disableUnderline: true }}
                        sx={inputStyle}
                    />
                );
            case 'select':
                return (
                    <TextField select fullWidth disabled size="small" value="" sx={{ bgcolor: '#f8f9fa' }}>
                        {field.options && (field.options as any[]).map((opt: any, i: number) => {
                             const label = typeof opt === 'string' ? opt : opt.label;
                             const val = typeof opt === 'string' ? opt : opt.value;
                             return <MenuItem key={i} value={val}>{label}</MenuItem>;
                        })}
                    </TextField>
                );
            case 'radio':
                return (
                    <FormControl component="fieldset">
                        <RadioGroup row sx={{ gap: 1 }}>
                            {field.options && (field.options as any[]).map((opt: any, i: number) => {
                                const label = typeof opt === 'string' ? opt : opt.label;
                                return (
                                    <FormControlLabel 
                                        key={i} 
                                        value={typeof opt === 'string' ? opt : opt.value} 
                                        control={<Radio size="small" disabled />} 
                                        label={<Typography variant="body2">{label}</Typography>} 
                                    />
                                );
                            })}
                            {(!field.options || field.options.length === 0) && <Typography variant="caption" color="text.secondary">選択肢を追加してください</Typography>}
                        </RadioGroup>
                    </FormControl>
                );
            case 'checkbox':
                return (
                    <FormControl component="fieldset">
                         <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {field.options && (field.options as any[]).map((opt: any, i: number) => {
                                const label = typeof opt === 'string' ? opt : opt.label;
                                return (
                                    <FormControlLabel 
                                        key={i} 
                                        control={<Checkbox size="small" disabled />} 
                                        label={<Typography variant="body2">{label}</Typography>} 
                                    />
                                );
                            })}
                            {(!field.options || field.options.length === 0) && <Typography variant="caption" color="text.secondary">選択肢を追加してください</Typography>}
                        </Box>
                    </FormControl>
                );
            case 'divider':
                 return <Divider sx={{ borderColor: '#333', borderBottomWidth: 2, my: 1 }} />;
            case 'label':
                // Label component fix: consistently show the label value
                return <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{field.label || '見出し'}</Typography>
            default:
                return null;
        }
    };

    // Label component override to remove card style
    if (field.type === 'label') {
        return (
            <Paper
                elevation={0}
                onClick={onClick}
                sx={{
                    p: 1,
                    height: '100%',
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    border: isSelected ? '2px solid' : '1px dashed transparent',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: (field as any).verticalAlign === 'top' ? 'flex-start' : (field as any).verticalAlign === 'bottom' ? 'flex-end' : 'center',
                    justifyContent: (field as any).textAlign === 'center' ? 'center' : (field as any).textAlign === 'right' ? 'flex-end' : 'flex-start',
                    position: 'relative',
                    cursor: 'pointer',
                    '&:hover': { border: '1px dashed #ccc' }
                }}
            >
                 <Typography variant="h6" sx={{ fontWeight: 'bold', width: '100%', textAlign: (field as any).textAlign || 'left' }}>
                     {field.label || '見出し'}
                 </Typography>
                 
                 {isSelected && (
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        sx={{
                            position: 'absolute',
                            right: 0,
                            top: -10,
                            bgcolor: 'white',
                            border: '1px solid #ddd',
                             '&:hover': { bgcolor: 'error.50', color: 'error.main' }
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                 )}
            </Paper>
        );
    }

    if (field.type === 'divider') {
        return (
            <Paper
                elevation={0}
                onClick={onClick}
                sx={{
                    p: 1,
                    height: '100%',
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    border: isSelected ? '2px solid' : '1px dashed #ccc',
                    borderColor: isSelected ? 'primary.main' : '#ccc',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    '&:hover .actions': { opacity: 1 }
                }}
            >
                <Box sx={{ width: '100%' }}><Divider sx={{ borderColor: '#333', borderBottomWidth: 2 }} /></Box>
                 {isSelected && (
                    <Box className="actions" sx={{ position: 'absolute', right: 8, top: -12, bgcolor: 'white', border: '1px solid #ddd', borderRadius: 4, display: 'flex' }}>
                        <IconButton size="small" onClick={onDelete} color="error"><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                 )}
            </Paper>
        );
    }

    if (field.type === 'group') {
        return (
            <Paper
                elevation={0}
                onClick={onClick}
                sx={{
                    p: 0,
                    height: '100%',
                    bgcolor: isSelected ? '#e8f4fc' : '#f8fafc',
                    border: isSelected ? '2px solid' : '2px dashed',
                    borderColor: isSelected ? 'primary.main' : '#90caf9',
                    borderRadius: 2,
                    position: 'relative',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    '&:hover': {
                        borderColor: isSelected ? 'primary.main' : 'primary.light',
                    },
                }}
            >
                {/* Group Header */}
                <Box sx={{ 
                    bgcolor: '#e3f2fd', 
                    px: 2, 
                    py: 1, 
                    borderBottom: '1px solid #90caf9',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1 
                }}>
                    <AccountTreeIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {field.label || 'セクション'}
                    </Typography>
                </Box>
                
                {/* Group Content Area */}
                <Box sx={{ 
                    p: 2, 
                    minHeight: 60, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.5)'
                }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        このセクション以降のフィールドがグループ化されます
                    </Typography>
                </Box>

                {isSelected && (
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'white',
                            border: '1px solid #ddd',
                            '&:hover': { bgcolor: 'error.50', color: 'error.main' }
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                )}
            </Paper>
        );
    }

    return (
        <Paper
            elevation={0}
            onClick={onClick}
            sx={{
                p: 1.5,
                height: '100%',
                bgcolor: 'white',
                border: isSelected ? '2px solid' : '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.1s',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 4px rgba(25, 118, 210, 0.1)' : 'none',
                '&:hover': {
                    borderColor: isSelected ? 'primary.main' : 'primary.light',
                },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ color: isSelected ? 'primary.main' : 'text.secondary', display: 'flex' }}>
                    {React.cloneElement(getIcon() as any, { fontSize: 'small' })}
                </Box>
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{field.label}</Typography>
                {field.required && <Chip label="必須" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem' }} />}
            </Box>

            <Box sx={{ flex: 1, opacity: 0.8 }}>
                {renderPreview()}
            </Box>

            {isSelected && (
                <IconButton
                    size="small"
                    onClick={onDelete}
                    sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'error.50',
                        color: 'error.main',
                        '&:hover': { bgcolor: 'error.100' }
                    }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            )}
        </Paper>
    );
}

export default function AppFormEditorPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const appId = params.id as string;

    const [formName, setFormName] = useState('');
    const [fields, setFields] = useState<FormField[]>([]);
    const [layout, setLayout] = useState<any[]>([]);
    const [counter, setCounter] = useState(0);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const { width, containerRef, mounted } = useContainerWidth({
        measureBeforeMount: false,
        initialWidth: 800,
    });

    const { data: app } = useQuery({
        queryKey: ['apps', appId],
        queryFn: () => api.get(`/application-definitions/${appId}`),
        enabled: !!appId,
    });

    useEffect(() => {
        if ((app as any)?.formDefinition) {
            setFormName((app as any).formDefinition.name || '');
            const schema = (app as any).formDefinition.schema || {};
            const props = schema.properties || {};
            const existingFields = Object.entries(props).map(([id, prop]: [string, any]) => ({
                id,
                type: prop.type || 'text',
                label: prop.title || id,
                options: prop.options, // This might be string[] or Option[]
                required: (schema.required || []).includes(id),
                readOnly: prop.readOnly,
                includeTime: prop.includeTime,
                textAlign: prop.textAlign,
                verticalAlign: prop.verticalAlign
            }));
            setFields(existingFields);
            setLayout(schema['x-layout'] || []);

            // Initial counter setup
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
                const newId = `field_${counter}_${Date.now()}`;
                setCounter(c => c + 1);

                const defaultOptions = ['select', 'radio', 'checkbox'].includes(type)
                    ? [{ label: '選択肢1', value: 'opt1' }, { label: '選択肢2', value: 'opt2' }]
                    : undefined;

                const newField = { id: newId, type, label, options: defaultOptions };
                setFields(prev => [...prev, newField]);
                setSelectedFieldId(newId); // Select the new field immediately

                const droppedItem = layoutArr.find((l: any) => l.i === '__dropping_elem__');
                let newHeight = 2;
                let newWidth = 6;

                if (['textarea', 'radio', 'checkbox', 'group'].includes(type)) newHeight = 3;
                if (['divider', 'label'].includes(type)) {
                    newHeight = 1;
                    newWidth = 12;
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

    const handleRemoveField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
        setLayout(layout.filter((l: any) => l.i !== id));
        if (selectedFieldId === id) setSelectedFieldId(null);
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
                    options: field.options,
                    readOnly: field.readOnly,
                    includeTime: field.includeTime,
                    textAlign: (field as any).textAlign,
                    verticalAlign: (field as any).verticalAlign
                }
            }), {}),
            "x-layout": layout,
            required: fields.filter(f => f.required).map(f => f.id)
        };

        saveMutation.mutate({ name: formName, schema });
    };

    const selectedField = fields.find(f => f.id === selectedFieldId) || null;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
            {/* Header Toolbar */}
            <Paper elevation={0} sx={{ 
                p: 2, 
                borderBottom: '1px solid #e0e0e0',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                zIndex: 10
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} component={Link} href={`/designer/apps/${appId}`} size="small">
                        戻る
                    </Button>
                    <TextField
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="フォーム名"
                        variant="standard"
                        InputProps={{ disableUnderline: true, style: { fontSize: '1.1rem', fontWeight: 600 } }}
                    />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<VisibilityIcon />}
                        onClick={() => setPreviewOpen(true)}
                        size="small"
                    >
                        プレビュー
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSave} 
                        disabled={saveMutation.isPending} 
                        size="small"
                    >
                        保存
                    </Button>
                </Box>
            </Paper>


            {/* Main Editor Area (3-Column Layout) */}
            <Grid container sx={{ flex: 1, overflow: 'hidden' }}>
                {/* Left: Toolbox (20%) */}
                <Grid size={2.4} sx={{ borderRight: '1px solid #e0e0e0', bgcolor: '#fafafa', p: 2, overflowY: 'auto' }}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                        コンポーネント
                    </Typography>
                    {TOOLBOX_ITEMS.map((item) => (
                        <ToolboxItem key={item.type} type={item.type} label={item.label} icon={item.icon} />
                    ))}
                </Grid>

                {/* Center: Canvas (60%) */}
                <Grid size={7.2} sx={{ bgcolor: '#f4f6f8', p: 3, overflowY: 'auto', position: 'relative', height: '100%' }}>
                    {/* Background Pattern */}
                    <Box sx={{ 
                        position: 'absolute', inset: 0, zIndex: 0,
                        backgroundImage: 'radial-gradient(#e0e0e0 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                        pointerEvents: 'none'
                    }} />
                    
                    <div ref={containerRef} style={{ width: '100%', position: 'relative', zIndex: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'center' }}>
                            キャンバス (12列グリッド)
                        </Typography>
                        {mounted && (
                            <ReactGridLayout
                                className="layout"
                                style={{ minHeight: '600px' }}
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
                                    <div key={field.id} onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}>
                                        <FieldPreview
                                            field={field}
                                            isSelected={selectedFieldId === field.id}
                                            onClick={() => setSelectedFieldId(field.id)}
                                            onDelete={(e) => { e.stopPropagation(); handleRemoveField(field.id); }}
                                        />
                                    </div>
                                ))}
                            </ReactGridLayout>
                        )}
                    </div>
                </Grid>

                {/* Right: Property Panel (20-25%) */}
                <Grid size={2.4} sx={{ borderLeft: '1px solid #e0e0e0', bgcolor: 'white', overflowY: 'auto' }}>
                    <PropertyPanel
                        field={selectedField}
                        onUpdate={handleUpdateField}
                        existingIds={fields.map(f => f.id)}
                    />
                </Grid>
            </Grid>


            {/* Error/Success Messages */}
            {(error || success) && (
                <Box sx={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 2000 }}>
                    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
                    {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
                </Box>
            )}

            {/* Preview Modal */}
            <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>プレビュー</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ p: 2 }}>
                        <DynamicFormRenderer
                            schema={{
                                type: 'object',
                                properties: fields.reduce((acc, field) => ({
                                    ...acc,
                                    [field.id]: {
                                        type: field.type,
                                        title: field.label,
                                        options: field.options,
                                        readOnly: field.readOnly,
                                        includeTime: field.includeTime,
                                        textAlign: field.textAlign,
                                        verticalAlign: field.verticalAlign
                                    }
                                }), {}),
                                "x-layout": layout,
                                required: fields.filter(f => f.required).map(f => f.id)
                            }}
                            layouts={{ lg: layout }}
                            onSubmit={(data) => alert('送信データ:\n' + JSON.stringify(data, null, 2))}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
