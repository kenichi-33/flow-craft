'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    CircularProgress,
    Alert,
    Divider,
} from '@mui/material';
import { useParams } from 'next/navigation';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

interface AppVersion {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy: string | null;
    formSchema: any;
    flowNodes: any;
    flowEdges: any;
}

export default function VersionOverviewPage() {
    const params = useParams();
    const appId = params.id as string;
    const versionId = params.versionId as string;

    const { data: app, isLoading: appLoading } = useQuery({
        queryKey: ['apps', appId],
        queryFn: () => api.get(`/application-definitions/${appId}`),
        enabled: !!appId,
    });

    const { data: versions, isLoading: versionsLoading } = useQuery<AppVersion[]>({
        queryKey: ['app-versions', appId],
        queryFn: () => api.get(`/application-definitions/${appId}/versions`),
        enabled: !!appId,
    });

    const version = versions?.find(v => v.id === versionId);

    if (appLoading || versionsLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!version) {
        return <Alert severity="error">バージョンが見つかりません</Alert>;
    }

    const formFieldCount = version.formSchema?.properties 
        ? Object.keys(version.formSchema.properties).length 
        : 0;
    const flowNodeCount = Array.isArray(version.flowNodes) ? version.flowNodes.length : 0;

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
                概観 (v{version.version})
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                このビューは読み取り専用です。編集するには最新バージョンを使用してください。
            </Alert>

            <Grid container spacing={3}>
                {/* Version Info */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>バージョン情報</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography color="text.secondary">バージョン</Typography>
                                <Chip label={`v${version.version}`} size="small" color="primary" />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography color="text.secondary">アプリ名</Typography>
                                <Typography fontWeight="medium">{(app as any)?.name}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography color="text.secondary">公開日時</Typography>
                                <Typography>{new Date(version.publishedAt).toLocaleString('ja-JP')}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography color="text.secondary">公開者</Typography>
                                <Typography>{version.publishedBy || '-'}</Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                {/* Stats */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>定義サマリー</Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6 }}>
                                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                    <DescriptionIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                                    <Typography variant="h4" fontWeight="bold">{formFieldCount}</Typography>
                                    <Typography variant="body2" color="text.secondary">フォームフィールド</Typography>
                                </Paper>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                    <AccountTreeIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                                    <Typography variant="h4" fontWeight="bold">{flowNodeCount}</Typography>
                                    <Typography variant="body2" color="text.secondary">フローノード</Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
