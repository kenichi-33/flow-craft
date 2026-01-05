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
                p: 1.5,
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                cursor: 'grab',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { 
                    bgcolor: 'action.hover',
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                },
                '&:active': {
                    cursor: 'grabbing',
                    transform: 'translateY(0)',
                    boxShadow: 'none'
                },
                position: 'relative',
                userSelect: 'none',
            }}
        >
            <Box sx={{ 
                mr: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'primary.main',
                bgcolor: 'primary.light', // or alpha color
                p: 1,
                borderRadius: 1.5,
                width: 40,
                height: 40
            }}>
                {icon || <DragIndicatorIcon />}
            </Box>
            <Typography variant="subtitle2" fontWeight="bold">{label}</Typography>
            
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
