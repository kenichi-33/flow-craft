'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
} from '@mui/material';
import { useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestoreIcon from '@mui/icons-material/Restore';
import Link from 'next/link';

interface AppVersion {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy: string | null;
    formSchema: any;
    flowNodes: any;
    flowEdges: any;
}

interface AppDef {
    id: string;
    name: string;
    version: number;
    status: string;
}

export default function AppVersionsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const appId = params.id as string;
    const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { data: app } = useQuery<AppDef>({
        queryKey: ['apps', appId],
        queryFn: () => api.get(`/application-definitions/${appId}`),
        enabled: !!appId,
    });

    const { data: versions, isLoading } = useQuery<AppVersion[]>({
        queryKey: ['app-versions', appId],
        queryFn: () => api.get(`/application-definitions/${appId}/versions`),
        enabled: !!appId,
    });

    const restoreMutation = useMutation({
        mutationFn: (versionNumber: number) =>
            api.post(`/application-definitions/${appId}/restore/${versionNumber}`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apps', appId] });
            queryClient.invalidateQueries({ queryKey: ['app-versions', appId] });
            setSuccess('バージョンを復元しました');
            setRestoreVersion(null);
            setTimeout(() => setSuccess(null), 3000);
        },
        onError: (err: any) => {
            setError(err.message || '復元に失敗しました');
            setRestoreVersion(null);
        },
    });

    const handleRestore = (version: number) => {
        setRestoreVersion(version);
    };

    const confirmRestore = () => {
        if (restoreVersion) {
            restoreMutation.mutate(restoreVersion);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} component={Link} href={`/designer/apps/${appId}`}>
                    アプリに戻る
                </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Typography variant="h4">{app?.name} - バージョン履歴</Typography>
                <Chip label={`現在: v${app?.version}`} color="primary" />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>バージョン</TableCell>
                            <TableCell>公開日時</TableCell>
                            <TableCell>公開者</TableCell>
                            <TableCell>フォームフィールド数</TableCell>
                            <TableCell>フローノード数</TableCell>
                            <TableCell>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6}>読み込み中...</TableCell>
                            </TableRow>
                        ) : versions?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    バージョン履歴がありません。アプリを「公開」するとバージョンが作成されます。
                                </TableCell>
                            </TableRow>
                        ) : (
                            versions?.map((v) => (
                                <TableRow key={v.id} hover>
                                    <TableCell>
                                        <Chip
                                            label={`v${v.version}`}
                                            color={v.version === app?.version ? 'primary' : 'default'}
                                            variant={v.version === app?.version ? 'filled' : 'outlined'}
                                            size="small"
                                        />
                                        {v.version === app?.version && (
                                            <Chip label="現在" size="small" color="success" sx={{ ml: 1 }} />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(v.publishedAt).toLocaleString('ja-JP')}
                                    </TableCell>
                                    <TableCell>{v.publishedBy || '-'}</TableCell>
                                    <TableCell>
                                        {v.formSchema?.properties
                                            ? Object.keys(v.formSchema.properties).length
                                            : 0}
                                    </TableCell>
                                    <TableCell>
                                        {Array.isArray(v.flowNodes) ? v.flowNodes.length : 0}
                                    </TableCell>
                                    <TableCell>
                                        {v.version !== app?.version && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<RestoreIcon />}
                                                onClick={() => handleRestore(v.version)}
                                            >
                                                復元
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>バージョン管理について</Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" paragraph>
                    • アプリを「公開」するたびに新しいバージョンが作成されます
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    • 過去のバージョンに「復元」すると、そのバージョンの設定で新しいバージョンが作成されます
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    • 進行中の申請には影響しません（申請時点のバージョンが使用されます）
                </Typography>
            </Paper>

            {/* 復元確認ダイアログ */}
            <Dialog open={restoreVersion !== null} onClose={() => setRestoreVersion(null)}>
                <DialogTitle>バージョン復元の確認</DialogTitle>
                <DialogContent>
                    <Typography>
                        v{restoreVersion} の設定を復元しますか？
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        現在の設定は新しいバージョンとして保持されます。
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRestoreVersion(null)}>キャンセル</Button>
                    <Button
                        variant="contained"
                        onClick={confirmRestore}
                        disabled={restoreMutation.isPending}
                    >
                        {restoreMutation.isPending ? '復元中...' : '復元する'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
