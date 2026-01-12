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

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    formDefinition: { id: string; name: string };
    flowDefinition: { id: string; name: string };
    createdAt: string;
}

export default function ApplicationDefinitionsListPage() {
    const { data: appDefs, isLoading } = useQuery<ApplicationDefinition[]>({
        queryKey: ['application-definitions'],
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
            case 'ARCHIVED': return 'アーカイブ済';
            default: return status;
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">申請アプリ一覧</Typography>
                <Button
                    variant="contained"
                    component={Link}
                    href="/designer/applications/new"
                >
                    新規作成
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>名前</TableCell>
                            <TableCell>説明</TableCell>
                            <TableCell>フォーム</TableCell>
                            <TableCell>フロー</TableCell>
                            <TableCell>ステータス</TableCell>
                            <TableCell>作成日</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7}>読み込み中...</TableCell>
                            </TableRow>
                        ) : appDefs?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7}>申請アプリがありません。</TableCell>
                            </TableRow>
                        ) : (
                            appDefs?.map((appDef) => (
                                <TableRow key={appDef.id}>
                                    <TableCell>{appDef.name}</TableCell>
                                    <TableCell>{appDef.description || '-'}</TableCell>
                                    <TableCell>{appDef.formDefinition?.name || '-'}</TableCell>
                                    <TableCell>{appDef.flowDefinition?.name || '-'}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={getStatusLabel(appDef.status)}
                                            color={getStatusColor(appDef.status) as any}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{new Date(appDef.createdAt).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Button
                                            size="small"
                                            component={Link}
                                            href={`/designer/applications/${appDef.id}`}
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
