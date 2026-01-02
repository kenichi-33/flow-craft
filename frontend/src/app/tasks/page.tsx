'use client';

import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box, Chip, IconButton, Tooltip, Button, Paper, Typography, Divider,
    TextField, FormControl, InputLabel, Select, MenuItem, Grid, Collapse, InputAdornment
} from '@mui/material';
import Link from 'next/link';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface Task {
    id: string;
    status: string;
    stepId: string;
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        applicantId: string;
        applicationDefinition?: {
            name: string;
        };
        flowDefinition?: {
            nodes: any[];
        };
    };
}

interface RemandedApplication {
    id: string;
    applicationNumber: number;
    status: string;
    applicationDefinition?: {
        name: string;
    };
    updatedAt: string;
}

interface Filters {
    search?: string;
    applicationNumber?: string;
    dateFrom?: string;
    dateTo?: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'PENDING': return 'warning';
        case 'APPROVED': return 'success';
        case 'REJECTED': return 'error';
        default: return 'default';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'PENDING': return '保留中';
        case 'APPROVED': return '承認済';
        case 'REJECTED': return '却下';
        default: return status;
    }
};

function getStepLabel(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find(n => n.id === stepId);
    return node?.data?.label || stepId;
}

export default function TasksListPage() {
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>({});
    const [appliedFilters, setAppliedFilters] = useState<Filters>({});
    const [filterKey, setFilterKey] = useState(0);

    // 差し戻しされた申請を取得
    const { data: remandedApps } = useQuery<RemandedApplication[]>({
        queryKey: ['remanded-applications'],
        queryFn: async () => {
            const response: any = await api.get('/applications?status=REMANDED');
            return Array.isArray(response) ? response : response.data || [];
        },
    });

    // 下書き申請を取得
    const { data: draftApps } = useQuery<RemandedApplication[]>({
        queryKey: ['draft-applications'],
        queryFn: async () => {
            const response: any = await api.get('/applications?status=DRAFT');
            return Array.isArray(response) ? response : response.data || [];
        },
    });

    const fetchTasks = useCallback(async (params: FetchParams): Promise<PaginatedResponse<Task>> => {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page));
        queryParams.set('limit', String(params.limit));
        queryParams.set('status', 'PENDING'); // PENDINGのタスクのみ取得
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        // フィルターパラメータを追加
        if (appliedFilters.search) queryParams.set('search', appliedFilters.search);
        if (appliedFilters.applicationNumber) queryParams.set('applicationNumber', appliedFilters.applicationNumber);
        if (appliedFilters.dateFrom) queryParams.set('dateFrom', appliedFilters.dateFrom);
        if (appliedFilters.dateTo) queryParams.set('dateTo', appliedFilters.dateTo);

        return api.get(`/tasks?${queryParams.toString()}`);
    }, [appliedFilters]);

    const handleApplyFilters = () => {
        setAppliedFilters({ ...filters });
        setFilterKey(k => k + 1);
    };

    const handleClearFilters = () => {
        setFilters({});
        setAppliedFilters({});
        setFilterKey(k => k + 1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleApplyFilters();
        }
    };

    const hasActiveFilters = Object.values(appliedFilters).some(v => v);

    const columns: Column<Task>[] = [
        {
            id: 'applicationNumber',
            label: '申請ID',
            minWidth: 100,
            format: (_, row) => <strong>#{row.application?.applicationNumber}</strong>,
        },
        {
            id: 'appName',
            label: 'アプリ名',
            minWidth: 150,
            format: (_, row) => row.application?.applicationDefinition?.name || '不明',
        },
        {
            id: 'applicantId',
            label: '申請者',
            minWidth: 120,
            format: (_, row) => row.application?.applicantId,
        },
        {
            id: 'stepId',
            label: '現在のステップ',
            minWidth: 140,
            format: (value, row) => getStepLabel(value, row.application?.flowDefinition?.nodes),
        },
        {
            id: 'status',
            label: 'ステータス',
            minWidth: 100,
            format: (value) => (
                <Chip
                    label={getStatusLabel(value)}
                    color={getStatusColor(value) as any}
                    size="small"
                    sx={{ fontWeight: 600 }}
                />
            ),
        },
        {
            id: 'createdAt',
            label: 'タスク作成日時',
            minWidth: 160,
            format: (value) => (
                <span suppressHydrationWarning>
                    {new Date(value).toLocaleString('ja-JP')}
                </span>
            ),
        },
        {
            id: 'actions',
            label: '操作',
            minWidth: 100,
            sortable: false,
            searchable: false,
            format: (_, row) => (
                <Tooltip title="承認・差戻し">
                    <IconButton
                        size="small"
                        component={Link}
                        href={`/tasks/${row.id}`}
                        sx={{ color: '#667eea' }}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            {/* 差し戻しされた申請がある場合のアラート */}
            {remandedApps && remandedApps.length > 0 && (
                <Paper sx={{ mb: 3, p: 2, bgcolor: 'warning.light', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <RefreshIcon color="warning" />
                        <Typography variant="h6" color="warning.dark">
                            差し戻しされた申請があります
                        </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {remandedApps.map((app) => (
                            <Box key={app.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body2">
                                    <strong>#{app.applicationNumber}</strong> - {app.applicationDefinition?.name || '申請'}
                                </Typography>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    startIcon={<EditIcon />}
                                    component={Link}
                                    href={`/applications/${app.id}/edit`}
                                >
                                    再編集
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}

            {/* 下書き申請セクション */}
            {draftApps && draftApps.length > 0 && (
                <Paper sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <EditIcon color="action" />
                        <Typography variant="h6" color="text.secondary">
                            下書きの申請があります
                        </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {draftApps.map((app) => (
                            <Box key={app.id} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body2">
                                    <strong>#{app.applicationNumber}</strong> - {app.applicationDefinition?.name || '申請'}
                                </Typography>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={<EditIcon />}
                                    component={Link}
                                    href={`/applications/${app.id}/edit`}
                                >
                                    続きを編集
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}

            {/* フィルターパネル */}
            <Paper sx={{ mb: 2, overflow: 'hidden' }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        bgcolor: 'grey.50',
                        borderBottom: filterOpen ? '1px solid' : 'none',
                        borderColor: 'divider',
                        cursor: 'pointer',
                    }}
                    onClick={() => setFilterOpen(!filterOpen)}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FilterListIcon color={hasActiveFilters ? 'primary' : 'action'} />
                        <span>検索・フィルター</span>
                        {hasActiveFilters && (
                            <Chip label="適用中" size="small" color="primary" sx={{ height: 20 }} />
                        )}
                    </Box>
                    <Button size="small" variant="text">
                        {filterOpen ? '閉じる' : '開く'}
                    </Button>
                </Box>
                <Collapse in={filterOpen}>
                    <Box sx={{ p: 2 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="キーワード検索"
                                    value={filters.search || ''}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                    placeholder="アプリ名、申請者で検索..."
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon color="action" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="申請ID"
                                    type="number"
                                    value={filters.applicationNumber || ''}
                                    onChange={(e) => setFilters({ ...filters, applicationNumber: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                    placeholder="例: 1"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="作成日（開始）"
                                    type="date"
                                    value={filters.dateFrom || ''}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="作成日（終了）"
                                    type="date"
                                    value={filters.dateTo || ''}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 2 }}>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={handleClearFilters}
                                        size="small"
                                    >
                                        <ClearIcon />
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={handleApplyFilters}
                                        fullWidth
                                    >
                                        検索
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                </Collapse>
            </Paper>

            <DataTable
                key={filterKey}
                title="マイタスク"
                subtitle="あなたに割り当てられたタスク一覧"
                columns={columns}
                serverSide
                onFetch={fetchTasks}
                emptyMessage="タスクがありません"
                rowKey="id"
                hideSearch
            />
        </Box>
    );
}
