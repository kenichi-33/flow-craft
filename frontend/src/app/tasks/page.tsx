'use client';

import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box, Chip, IconButton, Tooltip, Button, Paper, Typography, Divider,
    TextField, Grid, Collapse, InputAdornment, FormControlLabel, Switch, Avatar
} from '@mui/material';
import Link from 'next/link';
import EditIcon from '@mui/icons-material/Edit';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import DataTable, { Column, FetchParams, PaginatedResponse } from '@/components/DataTable';
import { UserDisplay } from '@/components/UserDisplay';

interface Task {
    id: string;
    status: string;
    stepId: string;
    assignedTo?: string;
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
    myTasksOnly?: boolean;
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

// 担当者表示用のフォーマット
function formatAssignedTo(assignedTo?: string): string {
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

export default function TasksListPage() {
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>({ myTasksOnly: true });
    const [appliedFilters, setAppliedFilters] = useState<Filters>({ myTasksOnly: true });
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

        // 自分のタスクのみ表示
        if (appliedFilters.myTasksOnly) queryParams.set('myTasks', 'true');

        return api.get(`/tasks?${queryParams.toString()}`);
    }, [appliedFilters]);

    const handleApplyFilters = () => {
        setAppliedFilters({ ...filters });
        setFilterKey(k => k + 1);
    };

    const handleClearFilters = () => {
        setFilters({ myTasksOnly: true });
        setAppliedFilters({ myTasksOnly: true });
        setFilterKey(k => k + 1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleApplyFilters();
        }
    };

    const handleMyTasksToggle = () => {
        const newValue = !filters.myTasksOnly;
        setFilters({ ...filters, myTasksOnly: newValue });
        setAppliedFilters({ ...appliedFilters, myTasksOnly: newValue });
        setFilterKey(k => k + 1);
    };

    const hasActiveFilters = appliedFilters.search || appliedFilters.applicationNumber ||
        appliedFilters.dateFrom || appliedFilters.dateTo;

    const columns: Column<Task>[] = [
        {
            id: 'applicationNumber',
            label: '申請ID',
            minWidth: 80,
            format: (_, row) => <strong>#{row.application?.applicationNumber}</strong>,
        },
        {
            id: 'appName',
            label: 'アプリ名',
            minWidth: 130,
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
            minWidth: 100,
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
            label: '現在のステップ',
            minWidth: 120,
            format: (value, row) => getStepLabel(value, row.application?.flowDefinition?.nodes),
        },
        {
            id: 'status',
            label: 'ステータス',
            minWidth: 90,
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
            minWidth: 140,
            format: (value) => (
                <span suppressHydrationWarning>
                    {new Date(value).toLocaleString('ja-JP')}
                </span>
            ),
        },
        {
            id: 'actions',
            label: '操作',
            minWidth: 80,
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
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        差し戻しされた申請があります（{remandedApps.length}件）
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {remandedApps.map(app => (
                            <Box key={app.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip label={`#${app.applicationNumber}`} size="small" />
                                <Typography variant="body2">
                                    {app.applicationDefinition?.name}
                                </Typography>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<EditIcon />}
                                    component={Link}
                                    href={`/applications/${app.id}/edit`}
                                >
                                    編集
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </Paper>
            )}

            {/* 下書きがある場合のアラート */}
            {draftApps && draftApps.length > 0 && (
                <Paper sx={{ mb: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                        下書きの申請があります（{draftApps.length}件）
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {draftApps.map(app => (
                            <Box key={app.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip label={`#${app.applicationNumber}`} size="small" />
                                <Typography variant="body2">
                                    {app.applicationDefinition?.name}
                                </Typography>
                                <Button
                                    size="small"
                                    variant="outlined"
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

            {/* 自分のタスクトグル */}
            <Paper sx={{ mb: 2, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={appliedFilters.myTasksOnly || false}
                                onChange={handleMyTasksToggle}
                                color="primary"
                            />
                        }
                        label="自分のタスクのみ表示"
                    />
                    <Typography variant="body2" color="text.secondary">
                        {appliedFilters.myTasksOnly
                            ? '自分に割り当てられたタスクのみ表示しています'
                            : '全てのタスクを表示しています'}
                    </Typography>
                </Box>
            </Paper>

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
                                    placeholder="件名、アプリ名、申請者で検索..."
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
