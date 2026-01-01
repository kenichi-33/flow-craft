'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TableSortLabel,
    TextField,
    InputAdornment,
    Typography,
    Chip,
    IconButton,
    Tooltip,
    alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';

export interface Column<T> {
    id: keyof T | string;
    label: string;
    minWidth?: number;
    align?: 'left' | 'center' | 'right';
    format?: (value: any, row: T) => React.ReactNode;
    sortable?: boolean;
    searchable?: boolean;
}

// サーバーサイドページング用のパラメータ
export interface FetchParams {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// サーバーサイドページング用のレスポンス
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data?: T[];                          // クライアントサイドモード用
    title?: string;
    subtitle?: string;
    onRowClick?: (row: T) => void;
    loading?: boolean;
    onRefresh?: () => void;
    emptyMessage?: string;
    rowKey?: keyof T | ((row: T) => string);
    actions?: React.ReactNode;
    // サーバーサイドモード用
    serverSide?: boolean;
    onFetch?: (params: FetchParams) => Promise<PaginatedResponse<T>>;
    defaultSortBy?: string;
    defaultSortOrder?: 'asc' | 'desc';
}

type Order = 'asc' | 'desc';

export default function DataTable<T extends Record<string, any>>({
    columns,
    data = [],
    title,
    subtitle,
    onRowClick,
    loading: externalLoading = false,
    onRefresh,
    emptyMessage = 'データがありません',
    rowKey = 'id' as keyof T,
    actions,
    // サーバーサイドモード
    serverSide = false,
    onFetch,
    defaultSortBy = 'createdAt',
    defaultSortOrder = 'desc',
}: DataTableProps<T>) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [order, setOrder] = useState<Order>(defaultSortOrder);
    const [orderBy, setOrderBy] = useState<string>(defaultSortBy);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchDebounce, setSearchDebounce] = useState('');

    // サーバーサイドモード用の状態
    const [serverData, setServerData] = useState<T[]>([]);
    const [serverTotal, setServerTotal] = useState(0);
    const [serverLoading, setServerLoading] = useState(false);

    // デバウンス処理
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchDebounce(searchQuery);
            if (serverSide) {
                setPage(0); // 検索時はページをリセット
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, serverSide]);

    // サーバーサイドモードのデータ取得
    const fetchData = useCallback(async () => {
        if (!serverSide || !onFetch) return;

        setServerLoading(true);
        try {
            const response = await onFetch({
                page: page + 1, // APIは1-indexedなので変換
                limit: rowsPerPage,
                search: searchDebounce || undefined,
                sortBy: orderBy || undefined,
                sortOrder: order,
            });
            setServerData(response.data);
            setServerTotal(response.pagination.total);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setServerData([]);
            setServerTotal(0);
        } finally {
            setServerLoading(false);
        }
    }, [serverSide, onFetch, page, rowsPerPage, searchDebounce, orderBy, order]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ローディング状態
    const loading = serverSide ? serverLoading : externalLoading;

    // クライアントサイドモード: 検索フィルタリング
    const filteredData = useMemo(() => {
        if (serverSide) return serverData;
        if (!searchQuery.trim()) return data;
        const query = searchQuery.toLowerCase();
        return data.filter((row) =>
            columns.some((col) => {
                if (col.searchable === false) return false;
                const value = row[col.id as keyof T];
                if (value == null) return false;
                return String(value).toLowerCase().includes(query);
            })
        );
    }, [serverSide, serverData, data, searchQuery, columns]);

    // クライアントサイドモード: ソート
    const sortedData = useMemo(() => {
        if (serverSide) return filteredData;
        if (!orderBy) return filteredData;
        return [...filteredData].sort((a, b) => {
            const aVal = a[orderBy as keyof T];
            const bVal = b[orderBy as keyof T];
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }, [serverSide, filteredData, order, orderBy]);

    // クライアントサイドモード: ページング
    const paginatedData = useMemo(() => {
        if (serverSide) return sortedData;
        return sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [serverSide, sortedData, page, rowsPerPage]);

    // 総件数
    const totalCount = serverSide ? serverTotal : filteredData.length;

    const handleSort = (columnId: string) => {
        const isAsc = orderBy === columnId && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(columnId);
        if (serverSide) {
            setPage(0); // サーバーサイドモードではソート時にページをリセット
        }
    };

    const handleChangePage = (_: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const getRowKey = (row: T, index: number): string => {
        if (typeof rowKey === 'function') return rowKey(row);
        return String(row[rowKey]) || String(index);
    };

    const handleRefresh = () => {
        if (serverSide) {
            fetchData();
        }
        onRefresh?.();
    };

    return (
        <Paper
            elevation={0}
            sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
            }}
        >
            {/* ヘッダー */}
            {(title || actions) && (
                <Box
                    sx={{
                        p: 2.5,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                >
                    <Box>
                        {title && (
                            <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
                                {title}
                            </Typography>
                        )}
                        {subtitle && (
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mt: 0.5 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        {actions}
                    </Box>
                </Box>
            )}

            {/* ツールバー */}
            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha('#667eea', 0.03),
                }}
            >
                <TextField
                    placeholder="検索..."
                    size="small"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!serverSide) setPage(0);
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                    }}
                    sx={{
                        minWidth: 280,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            bgcolor: 'white',
                        },
                    }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Chip
                        label={`${totalCount} 件`}
                        size="small"
                        sx={{
                            bgcolor: alpha('#667eea', 0.1),
                            color: '#667eea',
                            fontWeight: 600,
                        }}
                    />
                    {(onRefresh || serverSide) && (
                        <Tooltip title="更新">
                            <IconButton onClick={handleRefresh} size="small" sx={{ color: '#667eea' }}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {/* テーブル */}
            <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={String(column.id)}
                                    align={column.align || 'left'}
                                    style={{ minWidth: column.minWidth }}
                                    sx={{
                                        fontWeight: 700,
                                        bgcolor: '#f8fafc',
                                        borderBottom: '2px solid',
                                        borderColor: 'divider',
                                        py: 1.5,
                                    }}
                                >
                                    {column.sortable !== false ? (
                                        <TableSortLabel
                                            active={orderBy === column.id}
                                            direction={orderBy === column.id ? order : 'asc'}
                                            onClick={() => handleSort(String(column.id))}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    ) : (
                                        column.label
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center" sx={{ py: 8 }}>
                                    <Typography color="text.secondary">読み込み中...</Typography>
                                </TableCell>
                            </TableRow>
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center" sx={{ py: 8 }}>
                                    <Typography color="text.secondary">{emptyMessage}</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((row, index) => (
                                <TableRow
                                    key={getRowKey(row, index)}
                                    hover
                                    onClick={() => onRowClick?.(row)}
                                    sx={{
                                        cursor: onRowClick ? 'pointer' : 'default',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            bgcolor: alpha('#667eea', 0.04),
                                        },
                                        '&:nth-of-type(even)': {
                                            bgcolor: alpha('#f8fafc', 0.5),
                                        },
                                    }}
                                >
                                    {columns.map((column) => {
                                        const value = row[column.id as keyof T];
                                        return (
                                            <TableCell
                                                key={String(column.id)}
                                                align={column.align || 'left'}
                                                sx={{ py: 1.5 }}
                                            >
                                                {column.format ? column.format(value, row) : value}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* ページネーション */}
            <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="表示件数:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
                sx={{
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: '#f8fafc',
                }}
            />
        </Paper>
    );
}
