'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActionArea,
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppsIcon from '@mui/icons-material/Apps';
import Button from '@mui/material/Button';

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
}

export default function SelectAppPage() {
    const { data: apps, isLoading } = useQuery<ApplicationDefinition[]>({
        queryKey: ['active-apps'],
        queryFn: () => api.get('/application-definitions/active'),
    });

    return (
        <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/applications"
                >
                    申請一覧に戻る
                </Button>
            </Box>

            <Typography variant="h4" gutterBottom>新規申請</Typography>
            <Typography color="text.secondary" paragraph>
                申請したいアプリを選択してください。
            </Typography>

            {isLoading ? (
                <Typography>読み込み中...</Typography>
            ) : apps?.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        利用可能なアプリがありません。管理者に問い合わせてください。
                    </Typography>
                </Paper>
            ) : (
                <Grid container spacing={2}>
                    {apps?.map((app) => (
                        <Grid size={4} key={app.id}>
                            <Card>
                                <CardActionArea
                                    component={Link}
                                    href={`/applications/new/${app.id}`}
                                >
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <AppsIcon color="primary" />
                                            <Typography variant="h6">{app.name}</Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            {app.description || 'クリックして申請を開始'}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
