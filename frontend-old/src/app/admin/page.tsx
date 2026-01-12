'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Grid,
    Paper,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Button,
    LinearProgress,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AppsIcon from '@mui/icons-material/Apps';
import Link from 'next/link';

interface Application {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    applicantId: string;
    applicationDefinition?: {
        id: string;
        name: string;
    };
}

interface Task {
    id: string;
    status: string;
}

interface AppDefinition {
    id: string;
    name: string;
    status: string;
}

export default function AdminDashboardPage() {
    const { data: applications, isLoading: loadingApps } = useQuery<Application[]>({
        queryKey: ['admin-applications'],
        queryFn: () => api.get('/applications'),
    });

    const { data: tasks, isLoading: loadingTasks } = useQuery<Task[]>({
        queryKey: ['admin-tasks'],
        queryFn: () => api.get('/tasks'),
    });

    const { data: appDefs, isLoading: loadingAppDefs } = useQuery<AppDefinition[]>({
        queryKey: ['admin-app-defs'],
        queryFn: () => api.get('/application-definitions'),
    });

    // Calculate real stats
    const stats = {
        totalApplications: applications?.length || 0,
        pendingTasks: tasks?.filter(t => t.status === 'PENDING').length || 0,
        completedApplications: applications?.filter(a => a.status === 'APPROVED').length || 0,
        activeApps: appDefs?.filter(a => a.status === 'ACTIVE').length || 0,
    };

    const isLoading = loadingApps || loadingTasks || loadingAppDefs;

    const StatCard = ({ title, value, icon, color, href }: any) => (
        <Card sx={{ height: '100%', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 } }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography color="text.secondary" gutterBottom variant="overline">
                            {title}
                        </Typography>
                        <Typography variant="h4">
                            {isLoading ? '-' : value}
                        </Typography>
                    </Box>
                    <Box sx={{
                        p: 1.5,
                        borderRadius: '50%',
                        bgcolor: `${color}.light`,
                        color: `${color}.main`
                    }}>
                        {icon}
                    </Box>
                </Box>
                {href && (
                    <Button component={Link} href={href} size="small" sx={{ mt: 1 }}>
                        詳細を見る
                    </Button>
                )}
            </CardContent>
        </Card>
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'APPROVED': return 'success';
            case 'IN_PROGRESS': return 'info';
            case 'REJECTED': return 'error';
            case 'REMANDED': return 'warning';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'APPROVED': return '完了';
            case 'IN_PROGRESS': return '処理中';
            case 'REJECTED': return '却下';
            case 'REMANDED': return '差戻し';
            case 'DRAFT': return '下書き';
            default: return status;
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>管理者ダッシュボード</Typography>
            <Typography color="text.secondary" paragraph>
                システム全体の状況を確認できます。
            </Typography>

            {isLoading && <LinearProgress sx={{ mb: 2 }} />}

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="総申請数"
                        value={stats.totalApplications}
                        icon={<AssignmentIcon />}
                        color="primary"
                        href="/admin/workflows"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="保留中タスク"
                        value={stats.pendingTasks}
                        icon={<PendingActionsIcon />}
                        color="warning"
                        href="/admin/tasks"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="完了済み申請"
                        value={stats.completedApplications}
                        icon={<CheckCircleIcon />}
                        color="success"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="公開中アプリ"
                        value={stats.activeApps}
                        icon={<AppsIcon />}
                        color="info"
                        href="/designer/apps"
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>最近の申請</Typography>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>アプリ名</TableCell>
                                        <TableCell>申請者</TableCell>
                                        <TableCell>ステータス</TableCell>
                                        <TableCell>申請日時</TableCell>
                                        <TableCell>操作</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {applications?.slice(0, 5).map((app) => (
                                        <TableRow key={app.id} hover>
                                            <TableCell>
                                                <strong>{app.applicationDefinition?.name || '不明'}</strong>
                                            </TableCell>
                                            <TableCell>{app.applicantId}</TableCell>
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
                                                    href={`/admin/workflows/${app.id}`}
                                                >
                                                    詳細
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {(!applications || applications.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center">
                                                申請がありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        {applications && applications.length > 5 && (
                            <Box sx={{ mt: 2, textAlign: 'right' }}>
                                <Button component={Link} href="/admin/workflows">
                                    すべて見る ({applications.length}件)
                                </Button>
                            </Box>
                        )}
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>クイックリンク</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button component={Link} href="/admin/workflows" variant="outlined" fullWidth>
                                ワークフロー進捗一覧
                            </Button>
                            <Button component={Link} href="/admin/tasks" variant="outlined" fullWidth>
                                タスク管理
                            </Button>
                            <Button component={Link} href="/designer/apps" variant="outlined" fullWidth>
                                アプリ管理
                            </Button>
                        </Box>
                    </Paper>

                    <Paper sx={{ p: 2, mt: 2 }}>
                        <Typography variant="h6" gutterBottom>公開中アプリ</Typography>
                        {appDefs?.filter(a => a.status === 'ACTIVE').slice(0, 5).map((appDef) => (
                            <Chip
                                key={appDef.id}
                                label={appDef.name}
                                sx={{ m: 0.5 }}
                                component={Link}
                                href={`/designer/apps/${appDef.id}`}
                                clickable
                            />
                        ))}
                        {(!appDefs || appDefs.filter(a => a.status === 'ACTIVE').length === 0) && (
                            <Typography color="text.secondary" variant="body2">
                                公開中のアプリはありません
                            </Typography>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
