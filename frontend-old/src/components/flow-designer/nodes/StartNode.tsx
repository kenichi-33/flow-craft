'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { Box, Typography } from '@mui/material';

// BPMN-style Start Node (Circle)
export default function StartNode({ data }: { data: any }) {
    return (
        <Box
            sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
                border: '3px solid #fff',
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    color: 'white',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}
            >
                {data.label || '開始'}
            </Typography>
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    background: '#2e7d32',
                    width: 10,
                    height: 10,
                    border: '2px solid white',
                }}
            />
        </Box>
    );
}
