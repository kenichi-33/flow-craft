'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, Typography } from '@mui/material';
import SortableField from './SortableField';

interface CanvasDroppableProps {
    fields: any[];
    onUpdateField: (id: string, updates: any) => void;
    onRemoveField: (id: string) => void;
}

export default function CanvasDroppable({ fields, onUpdateField, onRemoveField }: CanvasDroppableProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: 'canvas-droppable',
    });

    return (
        <Box
            ref={setNodeRef}
            sx={{
                minHeight: 500,
                p: 2,
                bgcolor: isOver ? 'action.hover' : 'background.default',
                border: '2px dashed',
                borderColor: isOver ? 'primary.main' : 'divider',
                borderRadius: 1,
                transition: 'all 0.2s',
            }}
        >
            {fields.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography color="text.secondary">Drag form fields here</Typography>
                </Box>
            ) : (
                <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {fields.map((field) => (
                        <SortableField
                            key={field.id}
                            id={field.id}
                            field={field}
                            onUpdate={onUpdateField}
                            onRemove={onRemoveField}
                        />
                    ))}
                </SortableContext>
            )}
        </Box>
    );
}
