'use client';

import React, { useState, useCallback } from 'react';
import { Box, Paper, Typography, Button, Chip, Avatar, TextField } from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';
import { api } from '@/lib/api';

const getRoleColor = (role: string) => {
    switch (role) {
        case 'wf_admin': return 'error';
        case 'wf_manager': return 'warning';
        case 'wf_approver': return 'info';
        case 'wf_user': return 'default';
        default: return 'default';
    }
};

const getRoleLabel = (role: string) => {
    switch (role) {
        case 'wf_admin': return '管理者';
        case 'wf_manager': return '管理職';
        case 'wf_approver': return '承認者';
        case 'wf_user': return '利用者';
        default: return role;
    }
};

interface User {
    id: string;
    username: string;
    displayName: string;
    email: string;
    enabled: boolean;
    position: string;
    groups: string[];
    roles: string[];
}

export default function UsersPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUsers = useCallback(async (params: FetchParams): Promise<PaginatedResponse<User>> => {
        const query = params.search || searchQuery || '*';
        const response = await api.get(`/users/search?q=${encodeURIComponent(query)}&page=${params.page}&limit=${params.limit}`) as any;
        return {
            data: response.data || [],
            pagination: response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 },
        };
    }, [searchQuery]);

    const columns: Column<User>[] = [
        {
            id: 'displayName',
            label: '氏名',
            minWidth: 180,
            format: (value, row) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#667eea', fontSize: '0.875rem' }}>
                        {value?.[0]}
                    </Avatar>
                    <Box>
                        <Typography variant="body2" fontWeight={600}>{value || row.username}</Typography>
                        <Typography variant="caption" color="text.secondary">@{row.username}</Typography>
                    </Box>
                </Box>
            ),
        },
        {
            id: 'email',
            label: 'メールアドレス',
            minWidth: 180,
        },
        {
            id: 'position',
            label: '役職',
            minWidth: 80,
        },
        {
            id: 'groups',
            label: '所属部署',
            minWidth: 180,
            format: (value: string[]) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(value || []).map((group) => (
                        <Chip
                            key={group}
                            label={group.split('/').pop()}
                            size="small"
                            variant="outlined"
                        />
                    ))}
                </Box>
            ),
        },
        {
            id: 'roles',
            label: '権限',
            minWidth: 200,
            format: (value: string[]) => (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(value || []).map((role) => (
                        <Chip
                            key={role}
                            label={getRoleLabel(role)}
                            size="small"
                            color={getRoleColor(role) as any}
                            variant="outlined"
                        />
                    ))}
                </Box>
            ),
        },
        {
            id: 'enabled',
            label: 'ステータス',
            minWidth: 80,
            format: (value) => (
                <Chip
                    label={value ? '有効' : '無効'}
                    size="small"
                    color={value ? 'success' : 'default'}
                />
            ),
        },
    ];

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/admin"
                    sx={{ color: '#667eea' }}
                >
                    ダッシュボードに戻る
                </Button>
            </Box>

            <Paper sx={{ mb: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    ※ ユーザーはKeycloakで管理されています。追加・編集・削除はKeycloak管理コンソール（http://localhost:8081）から行ってください。
                </Typography>
            </Paper>

            <Box sx={{ mb: 2 }}>
                <TextField
                    placeholder="名前またはユーザー名で検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size="small"
                    sx={{ width: 300 }}
                />
            </Box>

            <DataTable
                title="ユーザー管理"
                subtitle="Keycloakに登録されているユーザー一覧"
                columns={columns}
                emptyMessage="ユーザーが見つかりません"
                rowKey="id"
                serverSide
                onFetch={fetchUsers}
                hideSearch
            />
        </Box>
    );
}
