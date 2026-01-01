'use client';

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

interface ToolboxItemProps {
    type: string;
    label: string;
    icon?: React.ReactNode;
    id?: string;  // オプショナルなid属性
}

export default function ToolboxItem({ type, label, icon, id }: ToolboxItemProps) {
    const handleDragStart = (e: React.DragEvent) => {
        // Set JSON data as text/plain for ReactGridLayout onDrop
        e.dataTransfer.setData("text/plain", JSON.stringify({ type, label }));
        e.dataTransfer.effectAllowed = "copy";
    };

    return (
        <Paper
            draggable={true}
            onDragStart={handleDragStart}
            sx={{
                p: 1.5,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                cursor: 'grab',
                ':hover': { bgcolor: 'action.hover' },
                position: 'relative',
                unselectable: 'on',
            }}
            elevation={1}
        >
            <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {icon}
                <Typography variant="body2" sx={{ ml: icon ? 1 : 0 }}>{label}</Typography>
            </Box>
        </Paper>
    );
}
