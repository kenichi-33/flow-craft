'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Paper, Typography, IconButton, TextField } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';

interface SortableFieldProps {
    id: string;
    field: any;
    onUpdate: (id: string, updates: any) => void;
    onRemove: (id: string) => void;
}

export default function SortableField({ id, field, onUpdate, onRemove }: SortableFieldProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <Paper
            ref={setNodeRef}
            style={style}
            elevation={1}
            sx={{
                p: 2,
                mb: 2,
                display: 'flex',
                alignItems: 'flex-start',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
            }}
        >
            <Box
                {...attributes}
                {...listeners}
                sx={{
                    mr: 2,
                    mt: 1,
                    cursor: 'grab',
                    color: 'text.secondary',
                }}
            >
                <DragIndicatorIcon />
            </Box>

            <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" color="primary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        {field.type} Field
                    </Typography>
                    <IconButton size="small" onClick={() => onRemove(id)} color="error">
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>

                <TextField
                    label="Field Label"
                    fullWidth
                    size="small"
                    value={field.label}
                    onChange={(e) => onUpdate(id, { label: e.target.value })}
                    sx={{ mb: 1 }}
                />

                {(field.type === 'select' || field.type === 'radio') && (
                    <TextField
                        label="Options (comma separated)"
                        fullWidth
                        size="small"
                        value={field.options?.join(',') || ''}
                        onChange={(e) => onUpdate(id, { options: e.target.value.split(',') })}
                        sx={{ mb: 1 }}
                        helperText="e.g. Option A,Option B,Option C"
                    />
                )}

                <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Preview:</Typography>
                    {field.type === 'text' && <TextField disabled size="small" fullWidth placeholder="Text Input" />}
                    {field.type === 'textarea' && <TextField disabled size="small" fullWidth multiline rows={3} placeholder="Long Text Input" />}
                    {field.type === 'number' && <TextField disabled size="small" fullWidth placeholder="123" />}
                    {field.type === 'checkbox' && <Typography color="text.secondary">☑ Checkbox</Typography>}
                    {field.type === 'select' && <TextField disabled size="small" fullWidth select SelectProps={{ native: true }}><option>Select option...</option></TextField>}
                    {field.type === 'radio' && <Typography color="text.secondary">🔘 Radio Option</Typography>}
                    {field.type === 'date' && <TextField disabled size="small" fullWidth type="date" />}
                </Box>
            </Box>
        </Paper>
    );
}
