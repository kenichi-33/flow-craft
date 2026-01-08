'use client';

import React, { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import {
    Box, Chip, Button, IconButton, Tooltip, Paper, Collapse,
    TextField, FormControl, InputLabel, Select, MenuItem, Grid, InputAdornment, Typography
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'; // UNUSED but keeping if needed, removed in minimal edit
import { UserDisplay } from '@/components/UserDisplay'; 
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface Task {
    id: string;
    status: string;
    stepId: string;
    assignedTo: string | null;
    assignedToInfo?: any;
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        title: string;
        applicantId: string;
        applicantInfo?: any;
        applicationDefinition?: {
            name: string;
        };
        flowDefinition?: {
            nodes: any[];
        };
    };
}

interface Filters {
    search?: string;
    applicationNumber?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'PENDING': return 'warning';
        case 'COMPLETED': return 'success';
        default: return 'default';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'PENDING': return '保留中';
        case 'COMPLETED': return '完了';
        default: return status;
    }
};

const STATUS_OPTIONS = [
    { value: '', label: 'すべて' },
    { value: 'PENDING', label: '保留中' },
    { value: 'COMPLETED', label: '完了' },
];

// 担当者表示用のフォーマット
function formatAssignedTo(assignedTo?: string | null): string {
    if (!assignedTo) return '未指定';

    const assignments = assignedTo.split(',').map(s => s.trim());
    return assignments.map(a => {
        if (a.startsWith('user:')) return a.substring(5);
        if (a.startsWith('role:')) return `ロール: ${a.substring(5)}`;
        if (a.startsWith('group:')) return `グループ: ${a.substring(6)}`;
        if (a === 'applicant') return '申請者';
        if (a === 'applicant_manager') return '申請者の上長';
        return a;
    }).join(', ');
}

function getStepLabel(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find(n => n.id === stepId);
    return node?.data?.label || stepId;
}

export default function AdminTasksPage() {
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>({});
    const [appliedFilters, setAppliedFilters] = useState<Filters>({ status: 'PENDING' });
    const [filterKey, setFilterKey] = useState(0);

    const fetchTasks = useCallback(async (params: FetchParams): Promise<PaginatedResponse<Task>> => {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page));
        queryParams.set('limit', String(params.limit));
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        // フィルターパラメータを追加
        if (appliedFilters.search) queryParams.set('search', appliedFilters.search);
        if (appliedFilters.status) queryParams.set('status', appliedFilters.status);
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
        setAppliedFilters({ status: 'PENDING' });
        setFilterKey(k => k + 1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleApplyFilters();
        }
    };

    const hasActiveFilters = Object.entries(appliedFilters).some(([k, v]) => v && k !== 'status');

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
            id: 'title',
            label: '件名',
            minWidth: 200,
            format: (_, row) => <Typography variant="body2" fontWeight="bold">{row.application?.title || '無題'}</Typography>,
        },
        {
            id: 'applicantId',
            label: '申請者',
            minWidth: 120,
            format: (_, row) => <UserDisplay user={row.application?.applicantInfo} fallback={row.application?.applicantId} />,
        },
        {
            id: 'assignedTo',
            label: '担当者',
            minWidth: 140,
            format: (_, row) => <UserDisplay user={row.assignedToInfo} fallback={formatAssignedTo(row.assignedTo)} />,
        },
        {
            id: 'stepId',
            label: 'ステップ',
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
            label: '作成日時',
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
                <Tooltip title="詳細を見る">
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
            <Box sx={{ mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/admin"
                    sx={{ color: '#667eea' }}
                >
                    ダッシュボードに戻る
                </Button>
            </Box>

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
                                <FormControl fullWidth size="small">
                                    <InputLabel>ステータス</InputLabel>
                                    <Select
                                        value={filters.status ?? ''}
                                        label="ステータス"
                                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    >
                                        {STATUS_OPTIONS.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
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
                        </Grid>
                        <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
                            <Button
                                variant="outlined"
                                onClick={handleClearFilters}
                                startIcon={<ClearIcon />}
                            >
                                クリア
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleApplyFilters}
                                sx={{ minWidth: 100 }}
                            >
                                検索
                            </Button>
                        </Box>
                    </Box>
                </Collapse>
            </Paper>

            <DataTable
                key={filterKey}
                title="全タスク管理"
                subtitle="全てのタスクを管理できます"
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
