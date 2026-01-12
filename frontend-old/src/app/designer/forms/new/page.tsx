'use client';

import React, { useState } from 'react';
import { Box, Button, TextField, Paper, Typography, Grid, IconButton } from '@mui/material';
import { useRouter } from 'next/navigation';
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

// Define field types
interface FormField {
    id: string;
    type: 'text' | 'number' | 'checkbox' | 'textarea' | 'select' | 'radio' | 'date';
    label: string;
    options?: string[];
}

const TOOLBOX_ITEMS = [
    { type: 'text', label: 'Text Field', icon: <TextFieldsIcon /> },
    { type: 'textarea', label: 'Text Area', icon: <TextIcon /> },
    { type: 'number', label: 'Number Field', icon: <NumbersIcon /> },
    { type: 'select', label: 'Select', icon: <ListIcon /> },
    { type: 'radio', label: 'Radio Group', icon: <RadioButtonCheckedIcon /> },
    { type: 'checkbox', label: 'Checkbox', icon: <CheckBoxIcon /> },
    { type: 'date', label: 'Date Picker', icon: <CalendarTodayIcon /> },
];

export default function FormEditorPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [fields, setFields] = useState<FormField[]>([]);

    // RGL Layout State - simple array for ReactGridLayout
    const [layout, setLayout] = useState<any[]>([]);
    // Counter for unique IDs
    const [counter, setCounter] = useState(0);

    // Use container width hook for responsive grid
    const { width, containerRef, mounted } = useContainerWidth({
        measureBeforeMount: false,
        initialWidth: 800,
    });

    const onDrop = (layout: any, layoutItem: any, event: Event) => {
        const dragEvent = event as DragEvent;
        // Retrieve data from DataTransfer
        // Note: RGL might not pass the full dataTransfer in all versions, 
        // but typically the 'event' arg is the native DropEvent.
        try {
            const data = dragEvent.dataTransfer?.getData("application/json");
            if (data) {
                const { type, label } = JSON.parse(data);
                const newId = `field_${Date.now()}`;

                // Create new field
                const newField: FormField = {
                    id: newId,
                    type,
                    label: `New ${label}`,
                };

                setFields(prev => [...prev, newField]);

                // Update layout with the dropped item's ID
                // layoutItem contains the dropped position (x, y)
                // We need to replace the temporary 'i' from RGL (usually "__dropping_elem__") with our new ID
                // Actually RGL handles this differently. 
                // When onDrop is called, the item is already in 'layout' with 'i'="__dropping_elem__" (or similar).
                // We should return the new layout item or update state.

                // Standard RGL pattern for dropping:
                // Modify the dropped item ("__dropping_elem__") to have the new ID
                const droppedItem = layout.find((l: any) => l.i === '__dropping_elem__');
                if (droppedItem) {
                    droppedItem.i = newId;
                    droppedItem.w = 4; // Default width
                    droppedItem.h = 2; // Default height
                }

                setLayout(prev => [...prev, {
                    i: newId,
                    x: droppedItem?.x ?? 0,
                    y: droppedItem?.y ?? 0,
                    w: 4,
                    h: 2
                }]);
            }
        } catch (e) {
            console.error("Failed to parse drop data", e);
        }
    };

    const handleLayoutChange = React.useCallback((newLayout: readonly any[]) => {
        // Only update if there are actual items and layout differs
        setLayout(prev => {
            if (prev.length === 0 && newLayout.length === 0) return prev;
            // Deep compare to prevent infinite loop
            const prevStr = JSON.stringify(prev);
            const newStr = JSON.stringify(newLayout);
            if (prevStr === newStr) return prev;
            return [...newLayout];
        });
    }, []);

    const handleRemoveField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
        setLayout(layout.filter((l: any) => l.i !== id));
    };

    const handleUpdateField = (id: string, updates: any) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleSave = async () => {
        try {
            // Merge layout info into schema if needed, OR save layout separately.
            // For now, let's save layout into the schema 'ui:layout' or similar, 
            // BUT implementation_plan said "Grid Layout".
            // RJSF (react-jsonschema-form) might not support free grid easily without UI Schema.
            // DynamicFormRenderer needs to be updated to read this layout.

            // We will save layout in a custom property inside the form definition or strict schema.
            // Let's assume we save it in schema.x-layout or similar.

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
                "x-layout": layout // Save the layout config
            };

            await api.post('/forms', { name, schema });
            router.push('/designer/forms');
        } catch (e) {
            alert('Failed to save form');
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Form Editor (Grid Layout)</Typography>

            <Box sx={{ mb: 3 }}>
                <TextField
                    label="Form Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fullWidth
                />
            </Box>

            <Grid container spacing={3}>
                <Grid size={3}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Toolbox</Typography>
                        {TOOLBOX_ITEMS.map((item) => (
                            <ToolboxItem
                                key={item.type}
                                id={`toolbox-${item.type}`}
                                type={item.type}
                                label={item.label}
                                icon={item.icon}
                            />
                        ))}
                    </Paper>
                </Grid>

                <Grid size={9}>
                    <Paper sx={{ p: 2, minHeight: 600, bgcolor: '#f5f5f5' }}>
                        <Typography variant="h6" gutterBottom>Canvas</Typography>

                        <div ref={containerRef} style={{ width: '100%' }}>
                            {mounted && (
                                <ReactGridLayout
                                    className="layout"
                                    style={{ minHeight: '500px', background: 'white' }}
                                    layout={layout}
                                    gridConfig={{ cols: 12, rowHeight: 60 }}
                                    width={width}
                                    onDrop={onDrop}
                                    dropConfig={{ enabled: true, defaultItem: { w: 4, h: 2 } }}
                                    dragConfig={{ enabled: true }}
                                    resizeConfig={{ enabled: true }}
                                    droppingItem={{ i: "__dropping_elem__", x: 0, y: 0, w: 4, h: 2 }}
                                >
                                    {fields.map((field) => {
                                        return (
                                            <div key={field.id} style={{ background: 'white', border: '1px solid #ddd', padding: '8px', overflow: 'hidden' }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="subtitle2">{field.label} ({field.type})</Typography>
                                                    <IconButton size="small" onClick={() => handleRemoveField(field.id)} onMouseDown={(e) => e.stopPropagation()}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    value={field.label}
                                                    onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                                                    label="Label"
                                                    sx={{ mb: 1 }}
                                                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag when typing
                                                />
                                                {(field.type === 'select' || field.type === 'radio') && (
                                                    <TextField
                                                        size="small"
                                                        fullWidth
                                                        value={field.options?.join(',') || ''}
                                                        onChange={(e) => handleUpdateField(field.id, { options: e.target.value.split(',') })}
                                                        label="Options"
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </ReactGridLayout>
                            )}
                        </div>
                    </Paper>
                </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleSave} disabled={!name}>
                    Save Form
                </Button>
            </Box>
        </Box >
    );
}
