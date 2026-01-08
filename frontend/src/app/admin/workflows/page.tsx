'use client';

import React, { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import {
    Box, Chip, Button, IconButton, Tooltip, Paper, Collapse,
    TextField, FormControl, InputLabel, Select, MenuItem, Grid, InputAdornment
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TimelineIcon from '@mui/icons-material/Timeline';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import { UserDisplay } from '@/components/UserDisplay';

import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';

interface Application {
    id: string;
    applicationNumber: number;
    status: string;
    currentNodeId: string | null;
    createdAt: string;
    updatedAt: string;
    applicationDefinition?: {
        id: string;
        name: string;
    };
    flowDefinition?: {
        nodes: any[];
    };
    applicantId: string;
    applicantInfo?: any;
}

interface Filters {
    search?: string;
    applicationNumber?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

function getStepLabel(nodeId: string | null, nodes?: any[]): string {
    if (!nodeId || !nodes) return nodeId || '-';
    const node = nodes.find(n => n.id === nodeId);
    return node?.data?.label || nodeId;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'APPROVED': return 'success';
        case 'IN_PROGRESS': return 'info';
        case 'REJECTED': return 'error';
        case 'REMANDED': return 'warning';
        default: return 'default';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'APPROVED': return '承認済';
        case 'IN_PROGRESS': return '処理中';
        case 'REJECTED': return '却下';
        case 'REMANDED': return '差戻し';
        case 'DRAFT': return '下書き';
        default: return status;
    }
};

const STATUS_OPTIONS = [
    { value: '', label: 'すべて' },
    { value: 'DRAFT', label: '下書き' },
    { value: 'IN_PROGRESS', label: '処理中' },
    { value: 'APPROVED', label: '完了' },
    { value: 'REJECTED', label: '却下' },
    { value: 'REMANDED', label: '差戻し' },
];

export default function WorkflowsListPage() {
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>({});
    const [appliedFilters, setAppliedFilters] = useState<Filters>({});
    const [filterKey, setFilterKey] = useState(0);

    const fetchWorkflows = useCallback(async (params: FetchParams): Promise<PaginatedResponse<Application>> => {
        const queryParams = new URLSearchParams();
        queryParams.set('page', String(params.page));
        queryParams.set('limit', String(params.limit));
        if (params.sortBy) queryParams.set('sortBy', params.sortBy);
        if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

        // フィルターパラメータを追加
        if (appliedFilters.search) queryParams.set('search', appliedFilters.search);
        if (appliedFilters.applicationNumber) queryParams.set('applicationNumber', appliedFilters.applicationNumber);
        if (appliedFilters.status) queryParams.set('status', appliedFilters.status);
        if (appliedFilters.dateFrom) queryParams.set('dateFrom', appliedFilters.dateFrom);
        if (appliedFilters.dateTo) queryParams.set('dateTo', appliedFilters.dateTo);

        return api.get(`/applications?${queryParams.toString()}`);
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

    const columns: Column<Application>[] = [
        {
            id: 'applicationNumber',
            label: '申請ID',
            minWidth: 100,
            format: (value) => <strong>#{value}</strong>,
        },
        {
            id: 'appName',
            label: 'アプリ名',
            minWidth: 150,
            format: (_, row) => row.applicationDefinition?.name || '不明',
        },
        {
            id: 'applicantId',
            label: '申請者',
            minWidth: 120,
            format: (_, row) => <UserDisplay user={row.applicantInfo} fallback={row.applicantId} />,
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
            id: 'currentStep',
            label: '現在のステップ',
            minWidth: 140,
            format: (_, row) => getStepLabel(row.currentNodeId, row.flowDefinition?.nodes),
            searchable: false,
        },
        {
            id: 'createdAt',
            label: '申請日時',
            minWidth: 160,
            format: (value) => (
                <span suppressHydrationWarning>
                    {new Date(value).toLocaleString('ja-JP')}
                </span>
            ),
        },
        {
            id: 'updatedAt',
            label: '更新日時',
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
            minWidth: 120,
            sortable: false,
            searchable: false,
            format: (_, row) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="進捗を見る">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/admin/workflows/${row.id}`}
                            sx={{ color: '#667eea' }}
                        >
                            <TimelineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="詳細を見る">
                        <IconButton
                            size="small"
                            component={Link}
                            href={`/applications/${row.id}`}
                            sx={{ color: '#764ba2' }}
                        >
                            <VisibilityIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
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
                            <Grid size={{ xs: 12, md: 3 }}>
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
                                        value={filters.status || ''}
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
                                    label="申請日（開始）"
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
                                    label="申請日（終了）"
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
                title="ワークフロー進捗一覧"
                subtitle="全ての申請の進捗状況を確認できます"
                columns={columns}
                serverSide
                onFetch={fetchWorkflows}
                emptyMessage="ワークフローがありません"
                rowKey="id"
                hideSearch
            />
        </Box>
    );
}
