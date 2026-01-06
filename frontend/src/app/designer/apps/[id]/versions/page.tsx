'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
    Grid,
    Tabs,
    Tab,
} from '@mui/material';
import { useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import FieldPreview from '@/components/form-designer/FieldPreview';
import PropertyPanel from '@/components/form-designer/PropertyPanel';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';
import FlowPropertyPanel from '@/components/flow-designer/FlowPropertyPanel';


const useWidth = () => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(1200); // Default width

    useEffect(() => {
        if (!ref.current) return;
        
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(ref.current);

        // Initial set
        setWidth(ref.current.offsetWidth);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return { ref, width };
};


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
    
    // Dialog & Data States
    const [viewVersion, setViewVersion] = useState<AppVersion | null>(null);
    const [versionTab, setVersionTab] = useState(0);
    const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Inspection States
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const { ref: widthRef, width } = useWidth();

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

    const handleCloseDialog = () => {
        setViewVersion(null);
        setSelectedFieldId(null);
        setSelectedNodeId(null);
        setVersionTab(0);
    };

    // Derived State for Form Inspection
    const formFields = useMemo(() => {
        if (!viewVersion?.formSchema?.properties) return [];
        const requiredFields = Array.isArray(viewVersion.formSchema.required) 
            ? viewVersion.formSchema.required 
            : [];
            
        return Object.entries(viewVersion.formSchema.properties).map(([id, config]: [string, any]) => ({
            id,
            ...config,
            required: config.required || requiredFields.includes(id)
        }));
    }, [viewVersion]);

    const selectedField = useMemo(() => {
        if (!selectedFieldId || !formFields) return null;
        return formFields.find(f => f.id === selectedFieldId) || null;
    }, [selectedFieldId, formFields]);

    const formLayouts = useMemo(() => {
        if (!viewVersion) return { lg: [] };
        // Default layout generator if removed or missing
        const layout = viewVersion.formSchema?.['x-layout'] || formFields.map((f, i) => ({ i: f.id, x: 0, y: i * 2, w: 12, h: 2 }));
        return { lg: layout };
    }, [viewVersion, formFields]);

    // Derived State for Flow Inspection
    const selectedNode = useMemo(() => {
        if (!selectedNodeId || !viewVersion?.flowNodes) return null;
        return viewVersion.flowNodes.find((n: any) => n.id === selectedNodeId) || null;
    }, [selectedNodeId, viewVersion]);


    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>バージョン履歴</Typography>
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
                            versions?.map((v: any) => (
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
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<VisibilityIcon />}
                                                onClick={() => setViewVersion(v)}
                                            >
                                                詳細
                                            </Button>
                                            {v.version !== app?.version && (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="warning"
                                                    startIcon={<RestoreIcon />}
                                                    onClick={() => setRestoreVersion(v.version)}
                                                >
                                                    復元
                                                </Button>
                                            )}
                                        </Box>
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
                        （下書き状態の設定は上書きされます）
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRestoreVersion(null)}>キャンセル</Button>
                    <Button
                        variant="contained"
                        onClick={confirmRestore}
                        disabled={restoreMutation.isPending}
                        color="warning"
                    >
                        {restoreMutation.isPending ? '復元中...' : '復元する'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* バージョン詳細ダイアログ */}
            <Dialog 
                open={viewVersion !== null} 
                onClose={handleCloseDialog}
                maxWidth="xl"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        バージョン詳細
                        {viewVersion && <Chip label={`v${viewVersion.version}`} size="small" />}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {viewVersion && new Date(viewVersion.publishedAt).toLocaleString('ja-JP')}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0, height: '80vh', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
                        <Tabs value={versionTab} onChange={(_, val) => setVersionTab(val)}>
                            <Tab label="フォーム定義" icon={<DescriptionIcon />} iconPosition="start" />
                            <Tab label="フロー定義" icon={<AccountTreeIcon />} iconPosition="start" />
                            <Tab label="設定データ (JSON)" />
                        </Tabs>
                    </Box>

                    {/* タブコンテンツ */}
                    <Box sx={{ flexGrow: 1, overflow: 'hidden', bgcolor: '#f5f5f5' }}>
                        {viewVersion && versionTab === 0 && (
                            <Box sx={{ height: '100%', p: 2 }}>
                                <Grid container spacing={2} sx={{ height: '100%' }}>
                                    <Grid size={{ xs: 12, md: 8, lg: 9 }} sx={{ height: '100%', overflow: 'auto' }}>
                                        <Paper variant="outlined" sx={{ minHeight: '100%', p: 4, bgcolor: 'white' }} ref={widthRef}>
                                            <ResponsiveGridLayout
                                                className="layout"
                                                layouts={formLayouts}
                                                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                                                cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
                                                rowHeight={80}
                                                width={width}
                                                margin={[16, 16]}
                                                isDraggable={false}
                                                isResizable={false}
                                            >
                                                {formFields.map((field) => (
                                                    <div key={field.id} onClick={() => setSelectedFieldId(field.id)}>
                                                        <FieldPreview
                                                            field={field}
                                                            isSelected={selectedFieldId === field.id}
                                                            readOnly={true}
                                                            onClick={() => setSelectedFieldId(field.id)}
                                                        />
                                                    </div>
                                                ))}
                                            </ResponsiveGridLayout>
                                        </Paper>
                                    </Grid>
                                    
                                    {/* フォームプロパティ (Read Only) */}
                                    <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ height: '100%' }}>
                                        <Paper variant="outlined" sx={{ height: '100%', bgcolor: 'white' }}>
                                            <PropertyPanel 
                                                field={selectedField}
                                                onUpdate={() => {}} // No-op
                                                existingIds={[]}
                                                readOnly={true}
                                            />
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        {viewVersion && versionTab === 1 && (
                            <Box sx={{ height: '100%', p: 2 }}>
                                <Grid container spacing={2} sx={{ height: '100%' }}>
                                    {/* フローキャンバス (Interactive Read Only) */}
                                    <Grid size={{ xs: 12, md: 8, lg: 9 }} sx={{ height: '100%' }}>
                                        <Paper variant="outlined" sx={{ height: '100%', bgcolor: 'white' }}>
                                            <FlowVisualization
                                                nodes={viewVersion.flowNodes || []}
                                                edges={viewVersion.flowEdges || []}
                                                height={typeof window !== 'undefined' ? window.innerHeight * 0.7 : 600}
                                                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                                                showBackground
                                            />
                                        </Paper>
                                    </Grid>
                                    
                                    {/* フロープロパティ (Read Only) */}
                                    <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ height: '100%' }}>
                                        <Paper variant="outlined" sx={{ height: '100%', bgcolor: 'white' }}>
                                            <FlowPropertyPanel node={selectedNode} />
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}

                        {viewVersion && versionTab === 2 && (
                            <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
                                <Grid container spacing={4}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography variant="subtitle2" gutterBottom>フォーム定義 (Schema)</Typography>
                                        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#fff', overflow: 'auto' }}>
                                            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'menlo, monospace' }}>
                                                {JSON.stringify(viewVersion.formSchema, null, 2)}
                                            </pre>
                                        </Paper>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography variant="subtitle2" gutterBottom>フロー定義 (Nodes & Edges)</Typography>
                                        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#fff', overflow: 'auto' }}>
                                            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'menlo, monospace' }}>
                                                {JSON.stringify({ 
                                                    nodes: viewVersion.flowNodes,
                                                    edges: viewVersion.flowEdges 
                                                }, null, 2)}
                                            </pre>
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={handleCloseDialog} variant="contained">閉じる</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
