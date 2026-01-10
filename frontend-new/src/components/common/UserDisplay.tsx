import React from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export interface UserSnapshot {
    username: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    department?: string;
    type?: 'user' | 'group' | 'role' | 'other';
}

interface UserDisplayProps {
    user?: UserSnapshot | null;
    fallback?: string;
}

export const UserDisplay: React.FC<UserDisplayProps> = ({ user, fallback }) => {
    if (!user) {
        return <span className="text-sm">{fallback || '-'}</span>;
    }

    // Role, Group, or special types might not have first/last name
    if (user.type && user.type !== 'user') {
        const displayName = user.displayName || user.username || fallback || '-';
        return <span className="text-sm">{displayName}</span>;
    }

    // User display logic - show full name (lastName firstName in Japanese order)
    const nameStr = [user.lastName, user.firstName].filter(Boolean).join(' ');
    const fullName = user.displayName || nameStr || user.username || fallback || '-';
    
    // Tooltip content
    const tooltipParts = [
        user.username,
        user.department,
        user.email
    ].filter(Boolean);
    const tooltipText = tooltipParts.join(' / ');

    if (!tooltipText || tooltipText === fullName) {
        return <span className="text-sm">{fullName}</span>;
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="text-sm cursor-help border-b border-dotted border-muted-foreground">
                        {fullName}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export default UserDisplay;
