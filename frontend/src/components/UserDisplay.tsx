import React from 'react';
import { Typography, Tooltip, Box } from '@mui/material';

export interface UserSnapshot {
    username: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    department?: string;
    type?: 'user' | 'group' | 'role' | 'other';
}

interface UserDisplayProps {
    user: UserSnapshot | null | undefined;
    fallback?: string;
}

export const UserDisplay: React.FC<UserDisplayProps> = ({ user, fallback }) => {
    if (!user) {
        return <Typography variant="body2" component="span">{fallback || '-'}</Typography>;
    }

    // Role, Group, or special types might not have first/last name
    if (user.type && user.type !== 'user') {
        const displayName = user.username || fallback || '-'; // username field holds the name for groups/roles in our snapshot logic
        return <Typography variant="body2" component="span">{displayName}</Typography>;
    }

    // User display logic
    const fullName = [user.lastName, user.firstName].filter(Boolean).join(' ') || user.username || fallback || '-';
    
    // Tooltip content
    const tooltipParts = [
        user.username,
        user.department,
        user.email
    ].filter(Boolean);
    const tooltipText = tooltipParts.join(' / ');

    return (
        <Tooltip title={tooltipText} arrow>
            <Typography variant="body2" component="span" sx={{ cursor: 'help', borderBottom: '1px dotted #999' }}>
                {fullName}
            </Typography>
        </Tooltip>
    );
};
