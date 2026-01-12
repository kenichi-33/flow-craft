'use client';

import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { UserDisplay } from './UserDisplay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplayIcon from '@mui/icons-material/Replay';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckIcon from '@mui/icons-material/Check';
import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneAllIcon from '@mui/icons-material/DoneAll';

interface HistoryItem {
    id: string;
    action: string;
    actorId: string;
    actorInfo?: any;
    comment?: string;
    stepId: string;
    actedAt?: string;
    createdAt?: string;
}

interface ApprovalHistoryProps {
    history: HistoryItem[];
}

const getIcon = (action: string) => {
    switch (action) {
        case 'START':
            return <PlayArrowIcon sx={{ color: '#2196f3' }} />;
        case 'APPROVE':
            return <CheckCircleIcon sx={{ color: '#4caf50' }} />;
        case 'REJECT':
            return <CancelIcon sx={{ color: '#f44336' }} />;
        case 'REMAND':
            return <ReplayIcon sx={{ color: '#ff9800' }} />;
        case 'BRANCH':
            return <CallSplitIcon sx={{ color: '#9c27b0' }} />;
        case 'SERVICE_TASK':
            return <SettingsIcon sx={{ color: '#607d8b' }} />;
        case 'SERVICE_TASK_COMPLETE':
            return <CheckIcon sx={{ color: '#4caf50' }} />;
        case 'APPLICATION_COMPLETE':
            return <DoneAllIcon sx={{ color: '#4caf50' }} />;
        default:
            return <InfoIcon sx={{ color: '#9e9e9e' }} />;
    }
};

const getLabel = (action: string) => {
    switch (action) {
        case 'START':
            return '申請開始';
        case 'APPROVE':
            return '承認';
        case 'REJECT':
            return '却下';
        case 'REMAND':
            return '差戻し';
        case 'BRANCH':
            return '条件分岐';
        case 'SERVICE_TASK':
            return 'システム処理開始';
        case 'SERVICE_TASK_COMPLETE':
            return 'システム処理完了';
        case 'APPLICATION_COMPLETE':
            return '申請完了';
        default:
            return action;
    }
};

export default function ApprovalHistory({ history }: ApprovalHistoryProps) {
    if (!history || history.length === 0) {
        return (
            <Typography color="text.secondary" variant="body2">
                まだ履歴がありません
            </Typography>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {history.map((h) => (
                <Box
                    key={h.id}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha('#667eea', 0.03),
                        border: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    {getIcon(h.action)}
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                            {getLabel(h.action)}
                            {h.comment && <span style={{ fontWeight: 400 }}> - {h.comment}</span>}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" suppressHydrationWarning>
                            {h.actorId === 'SYSTEM' ? 'システム' : <UserDisplay user={h.actorInfo} fallback={h.actorId} />} • {new Date(h.actedAt || h.createdAt || new Date()).toLocaleString('ja-JP')}
                        </Typography>
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
