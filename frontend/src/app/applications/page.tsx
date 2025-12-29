'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Chip,
    Button,
} from '@mui/material';
import Link from 'next/link';
import AddIcon from '@mui/icons-material/Add';

interface Application {
    id: string;
    applicationNumber: number;
    status: string;
    createdAt: string;
    applicationDefinition?: {
        id: string;
        name: string;
    };
    inputData: any;
}

export default function ApplicationsListPage() {
    const { data: applications, isLoading } = useQuery<Application[]>({
        queryKey: ['my-applications'],
        queryFn: () => api.get('/applications'),
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'success';
            case 'IN_PROGRESS': return 'info';
            case 'REJECTED': return 'error';
            case 'REMANDED': return 'warning';
            case 'DRAFT': return 'default';
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

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">申請一覧</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    component={Link}
                    href="/applications/new"
                >
                    新規申請
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>申請ID</TableCell>
                            <TableCell>アプリ名</TableCell>
                            <TableCell>ステータス</TableCell>
                            <TableCell>申請日</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5}>読み込み中...</TableCell>
                            </TableRow>
                        ) : applications?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5}>申請がありません</TableCell>
                            </TableRow>
                        ) : (
                            applications?.map((app) => (
                                <TableRow key={app.id} hover>
                                    <TableCell>
                                        <strong>#{app.applicationNumber}</strong>
                                    </TableCell>
                                    <TableCell>
                                        {app.applicationDefinition?.name || '不明'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(app.status)}
                                            color={getStatusColor(app.status) as any}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{new Date(app.createdAt).toLocaleString('ja-JP')}</TableCell>
                                    <TableCell>
                                        <Button
                                            size="small"
                                            component={Link}
                                            href={`/applications/${app.id}`}
                                        >
                                            詳細
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
