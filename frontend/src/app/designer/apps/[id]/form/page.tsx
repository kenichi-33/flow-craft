'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Button, TextField, Paper, Typography, Grid, IconButton, Alert,
    Select, MenuItem, Chip, Divider, Radio, RadioGroup, FormControl, FormControlLabel, Checkbox,
    Dialog, DialogTitle, DialogContent, DialogActions, Snackbar
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactGridLayout } from 'react-grid-layout';
import { api } from '@/lib/api';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ToolboxItem from '@/components/form-designer/ToolboxItem';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';
import PropertyPanel from '@/components/form-designer/PropertyPanel';
import FieldPreview from '@/components/form-designer/FieldPreview';

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




const useWidth = () => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(1200); // Default width

    useEffect(() => {
        if (!ref.current) return;
        
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(ref.current);

        // Initial set
        setWidth(ref.current.offsetWidth);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return { ref, width };
};


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



    const { ref: containerRef, width } = useWidth();
    const mounted = true; // simplifying mounted check as we use client component

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
                let isResizable = true;

                if (['textarea', 'radio', 'checkbox'].includes(type)) newHeight = 3;
                if (['divider', 'label', 'group'].includes(type)) {
                    newWidth = 12;
                    if (type === 'divider' || type === 'label') newHeight = 1;
                    if (type === 'group') {
                        newHeight = 1;
                        isResizable = false;
                    }
                }

                setLayout(prev => [...prev, {
                    i: newId,
                    x: droppedItem?.x ?? 0,
                    y: droppedItem?.y ?? 0,
                    w: newWidth,
                    h: newHeight,
                    isResizable: isResizable
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
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden' }}>
            {/* Local Actions (Save, Preview) - displayed as a toolbar inside the canvas area */}
            <Box sx={{ 
                p: 1, 
                mb: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
            }}>
                <TextField
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="フォーム名"
                    variant="standard"
                    InputProps={{ disableUnderline: true, style: { fontSize: '1.2rem', fontWeight: 'bold' } }}
                />
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
                        下書き保存
                    </Button>
                </Box>
            </Box>


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
                    
                    <div ref={containerRef} style={{ width: '100%', position: 'relative', zIndex: 1, minHeight: '600px' }}>
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
                                dropConfig={{ enabled: true, defaultItem: { w: 12, h: 2 } }}
                                dragConfig={{ enabled: true }}
                                resizeConfig={{ enabled: true }}
                                droppingItem={{ i: "__dropping_elem__", x: 0, y: 0, w: 12, h: 2 }}
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
            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" onClose={() => setError(null)} variant="filled">
                    {error}
                </Alert>
            </Snackbar>
            <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="success" onClose={() => setSuccess(null)} variant="filled">
                    {success}
                </Alert>
            </Snackbar>

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
