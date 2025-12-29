'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Button,
    TextField,
    Paper,
    Typography,
    Alert,
    Tabs,
    Tab,
    Chip,
    Divider,
    Card,
    CardContent,
    CardActions,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PublishIcon from '@mui/icons-material/Publish';
import Link from 'next/link';

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    version: number;
    publishedAt: string | null;
    formDefinitionId: string | null;
    flowDefinitionId: string | null;
    formDefinition: { id: string; name: string; schema: any } | null;
    flowDefinition: { id: string; name: string; nodes: any; edges: any } | null;
    createdAt: string;
    updatedAt: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export default function AppDetailPage() {
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const id = params.id as string;

    const [tabValue, setTabValue] = useState(0);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const { data: app, isLoading } = useQuery<ApplicationDefinition>({
        queryKey: ['apps', id],
        queryFn: () => api.get(`/application-definitions/${id}`),
        enabled: !!id,
    });

    useEffect(() => {
        if (app) {
            setName(app.name);
            setDescription(app.description || '');
            setStatus(app.status);
        }
    }, [app]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => api.put(`/application-definitions/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apps', id] });
            setSuccessMessage('保存しました');
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (err: any) => {
            setError(err.message || '保存に失敗しました');
        },
    });

    const handleSaveBasicInfo = () => {
        setError(null);
        if (!name.trim()) {
            setError('アプリ名は必須です');
            return;
        }
        updateMutation.mutate({ name: name.trim(), description: description.trim() || undefined, status });
    };

    const publishMutation = useMutation({
        mutationFn: () => api.post(`/application-definitions/${id}/publish`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apps', id] });
            setSuccessMessage('公開しました！');
            setTimeout(() => setSuccessMessage(null), 3000);
        },
        onError: (err: any) => {
            setError(err.message || '公開に失敗しました');
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'success';
            case 'DRAFT': return 'warning';
            case 'ARCHIVED': return 'default';
            default: return 'default';
        }
    };

    if (isLoading) {
        return <Box sx={{ p: 3 }}>読み込み中...</Box>;
    }

    if (!app) {
        return <Box sx={{ p: 3 }}>アプリが見つかりません</Box>;
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/designer/apps"
                >
                    一覧に戻る
                </Button>
                <Typography variant="h4" sx={{ flexGrow: 1 }}>{app.name}</Typography>
                <Chip
                    label={`v${app.version}`}
                    variant="outlined"
                    size="small"
                    component={Link}
                    href={`/designer/apps/${id}/versions`}
                    clickable
                />
                <Chip
                    label={status === 'ACTIVE' ? '公開中' : status === 'DRAFT' ? '下書き' : 'アーカイブ'}
                    color={getStatusColor(status) as any}
                />
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<PublishIcon />}
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending || !app.formDefinition || !app.flowDefinition}
                    title="フォーム/フローの設定をバージョンとして保存し、申請可能にします"
                >
                    {publishMutation.isPending ? '公開中...' : '新バージョン公開'}
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
                <strong>バージョン管理:</strong> フォーム/フローを編集後「保存」で下書き更新。
                「新バージョン公開」でバージョン番号が上がり、申請可能になります。
                バージョンをクリックで履歴確認・切り戻しができます。
            </Alert>

            {app.publishedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    最終公開: {new Date(app.publishedAt).toLocaleString('ja-JP')}
                </Typography>
            )}

            {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ mb: 3 }}>
                <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                    <Tab label="基本情報" />
                    <Tab label="フォーム設定" />
                    <Tab label="フロー設定" />
                </Tabs>
            </Paper>

            <TabPanel value={tabValue} index={0}>
                <Paper sx={{ p: 3, maxWidth: 600 }}>
                    <Typography variant="h6" gutterBottom>基本情報</Typography>
                    <TextField
                        label="アプリ名"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="説明"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        select
                        label="ステータス"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        fullWidth
                        SelectProps={{ native: true }}
                        sx={{ mb: 3 }}
                    >
                        <option value="DRAFT">下書き</option>
                        <option value="ACTIVE">公開中</option>
                        <option value="ARCHIVED">アーカイブ</option>
                    </TextField>
                    <Button
                        variant="contained"
                        onClick={handleSaveBasicInfo}
                        disabled={updateMutation.isPending}
                    >
                        保存
                    </Button>
                </Paper>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
                <Card sx={{ maxWidth: 600 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <DescriptionIcon color="primary" />
                            <Typography variant="h6">申請フォーム</Typography>
                        </Box>
                        {app.formDefinition ? (
                            <>
                                <Typography variant="body1" gutterBottom>
                                    <strong>{app.formDefinition.name}</strong>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    フィールド数: {Object.keys(app.formDefinition.schema?.properties || {}).length}
                                </Typography>
                            </>
                        ) : (
                            <Alert severity="warning">
                                フォームが設定されていません。「フォームを編集」から設定してください。
                            </Alert>
                        )}
                    </CardContent>
                    <Divider />
                    <CardActions>
                        <Button
                            startIcon={<EditIcon />}
                            component={Link}
                            href={`/designer/apps/${id}/form`}
                        >
                            フォームを編集
                        </Button>
                    </CardActions>
                </Card>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
                <Card sx={{ maxWidth: 600 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <AccountTreeIcon color="primary" />
                            <Typography variant="h6">承認フロー</Typography>
                        </Box>
                        {app.flowDefinition ? (
                            <>
                                <Typography variant="body1" gutterBottom>
                                    <strong>{app.flowDefinition.name}</strong>
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    ノード数: {app.flowDefinition.nodes?.length || 0}
                                </Typography>
                            </>
                        ) : (
                            <Alert severity="warning">
                                フローが設定されていません。「フローを編集」から設定してください。
                            </Alert>
                        )}
                    </CardContent>
                    <Divider />
                    <CardActions>
                        <Button
                            startIcon={<EditIcon />}
                            component={Link}
                            href={`/designer/apps/${id}/flow`}
                        >
                            フローを編集
                        </Button>
                    </CardActions>
                </Card>
            </TabPanel>
        </Box>
    );
}
