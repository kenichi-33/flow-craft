'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Chip,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    version: number;
    publishedAt: string | null;
    formDefinition: { id: string; name: string } | null;
    flowDefinition: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

export default function AppsListPage() {
    const { data: apps, isLoading } = useQuery<ApplicationDefinition[]>({
        queryKey: ['apps'],
        queryFn: () => api.get('/application-definitions'),
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'success';
            case 'DRAFT': return 'warning';
            case 'ARCHIVED': return 'default';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '公開中';
            case 'DRAFT': return '下書き';
            case 'ARCHIVED': return 'アーカイブ';
            default: return status;
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">アプリ管理</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    component={Link}
                    href="/designer/apps/new"
                >
                    新規アプリ作成
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>アプリ名</TableCell>
                            <TableCell>バージョン</TableCell>
                            <TableCell>ステータス</TableCell>
                            <TableCell>フォーム</TableCell>
                            <TableCell>フロー</TableCell>
                            <TableCell>更新日</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7}>読み込み中...</TableCell>
                            </TableRow>
                        ) : apps?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7}>アプリがありません。「新規アプリ作成」から作成してください。</TableCell>
                            </TableRow>
                        ) : (
                            apps?.map((app) => (
                                <TableRow key={app.id} hover>
                                    <TableCell>
                                        <Link href={`/designer/apps/${app.id}`} style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }}>
                                            {app.name}
                                        </Link>
                                        {app.description && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {app.description}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/designer/apps/${app.id}/versions`} style={{ textDecoration: 'none' }}>
                                            <Chip
                                                label={`v${app.version}`}
                                                size="small"
                                                variant="outlined"
                                                clickable
                                            />
                                        </Link>
                                        {app.publishedAt && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {new Date(app.publishedAt).toLocaleDateString('ja-JP')}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(app.status)}
                                            color={getStatusColor(app.status) as any}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {app.formDefinition ? (
                                            <Chip label={app.formDefinition.name} size="small" variant="outlined" />
                                        ) : (
                                            <Chip label="未設定" size="small" color="error" variant="outlined" />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {app.flowDefinition ? (
                                            <Chip label={app.flowDefinition.name} size="small" variant="outlined" />
                                        ) : (
                                            <Chip label="未設定" size="small" color="error" variant="outlined" />
                                        )}
                                    </TableCell>
                                    <TableCell>{new Date(app.updatedAt).toLocaleString('ja-JP')}</TableCell>
                                    <TableCell>
                                        <Button
                                            size="small"
                                            component={Link}
                                            href={`/designer/apps/${app.id}`}
                                        >
                                            編集
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
