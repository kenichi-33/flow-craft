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
            elevation={0}
            sx={{
                p: 1,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                cursor: 'grab',
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s',
                '&:hover': { 
                    bgcolor: 'action.hover',
                    borderColor: 'primary.main',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                },
                position: 'relative',
                userSelect: 'none',
            }}
        >
            <Box sx={{ 
                mr: 1.5, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'primary.main',
                bgcolor: 'primary.50',
                p: 0.5,
                borderRadius: 1,
                width: 32,
                height: 32
            }}>
                {icon ? React.cloneElement(icon as any, { fontSize: 'small' }) : <DragIndicatorIcon fontSize="small" />}
            </Box>
            <Typography variant="caption" fontWeight="bold" sx={{ fontSize: '0.75rem' }}>{label}</Typography>
            
            <DragIndicatorIcon 
                sx={{ 
                    ml: 'auto', 
                    color: 'text.disabled', 
                    fontSize: 20,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '.MuiPaper-root:hover &': { opacity: 1 }
                }} 
            />
        </Paper>
    );
}
