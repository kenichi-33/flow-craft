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
    Grid,
    Snackbar,
    Autocomplete,
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
    tags?: string[];
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
    const [tags, setTags] = useState<string[]>([]);
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
            setTags(app.tags || []);
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
        if (!name) {
            setError('アプリ名は必須です');
            return;
        }
        updateMutation.mutate({ name, description, tags });
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
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
                概観設定 (Overview)
            </Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                    {/* 基本情報編集 */}
                    <Paper sx={{ p: 3, mb: 3 }}>
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
                        <Autocomplete
                            multiple
                            freeSolo
                            options={[]}
                            value={tags}
                            onChange={(event, newValue) => setTags(newValue)}
                            renderTags={(value: readonly string[], getTagProps) =>
                                value.map((option: string, index: number) => {
                                    const { key, ...tagProps } = getTagProps({ index });
                                    return (
                                        <Chip variant="outlined" label={option} key={key} {...tagProps} />
                                    );
                                })
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    variant="outlined"
                                    label="タグ"
                                    placeholder="タグを入力してEnter"
                                    fullWidth
                                />
                            )}
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
                            helperText="「アーカイブ」にするとメニューから隠れます"
                        >
                            <option value="DRAFT">下書き (Draft)</option>
                            <option value="ACTIVE">公開中 (Active)</option>
                            <option value="ARCHIVED">アーカイブ (Archived)</option>
                        </TextField>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="contained"
                                onClick={handleSaveBasicInfo}
                                disabled={updateMutation.isPending}
                            >
                                基本情報を保存
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
                
                <Grid size={{ xs: 12, md: 4 }}>
                    {/* 構成サマリー */}
                    <Card sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <DescriptionIcon color="primary" />
                                <Typography variant="subtitle1" fontWeight="bold">フォーム</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                フィールド数: {Object.keys(app.formDefinition?.schema?.properties || {}).length}
                            </Typography>
                            <Button 
                                fullWidth 
                                variant="outlined" 
                                size="small" 
                                component={Link} 
                                href={`/designer/apps/${id}/form`}
                            >
                                編集する
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <AccountTreeIcon color="primary" />
                                <Typography variant="subtitle1" fontWeight="bold">フロー</Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                ノード数: {app.flowDefinition?.nodes?.length || 0}
                            </Typography>
                            <Button 
                                fullWidth 
                                variant="outlined" 
                                size="small" 
                                component={Link} 
                                href={`/designer/apps/${id}/flow`}
                            >
                                編集する
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            
            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" onClose={() => setError(null)} variant="filled">
                    {error}
                </Alert>
            </Snackbar>
            <Snackbar open={!!successMessage} autoHideDuration={3000} onClose={() => setSuccessMessage(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="success" onClose={() => setSuccessMessage(null)} variant="filled">
                    {successMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
}
