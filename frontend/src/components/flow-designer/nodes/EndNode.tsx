'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Typography } from '@mui/material';

// BPMN-style End Node (Circle with thick border)
export default function EndNode({ data }: { data: any }) {
    return (
        <Box
            sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef5350 0%, #c62828 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(239, 83, 80, 0.4)',
                border: '3px solid #fff',
            }}
        >
            <Handle
                type="target"
                position={Position.Top}
                style={{
                    background: '#c62828',
                    width: 10,
                    height: 10,
                    border: '2px solid white',
                }}
            />
            <Typography
                variant="caption"
                sx={{
                    color: 'white',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
            >
                {data.label || '終了'}
            </Typography>
        </Box>
    );
}
