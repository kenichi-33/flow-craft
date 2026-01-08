'use client';

import React, { useState } from 'react';
import { 
    Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    AppBar, Toolbar, Typography, Button, IconButton, Chip, Divider, 
    CircularProgress, Tooltip, Alert, Dialog, DialogTitle, DialogContent, 
    DialogActions, Slide 
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import PublishIcon from '@mui/icons-material/Publish';
import SearchIcon from '@mui/icons-material/Search';

const drawerWidth = 240;

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export default function AppStudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const id = params?.id as string;
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopOpen, setDesktopOpen] = useState(true);
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);

    const { data: app, isLoading } = useQuery({
        queryKey: ['apps', id],
        queryFn: () => api.get(`/application-definitions/${id}`),
        enabled: !!id,
        staleTime: 0, 
    });

    // Fetch existing versions to calculate correct next version
    const { data: versions } = useQuery<any[]>({
        queryKey: ['app-versions', id],
        queryFn: () => api.get(`/application-definitions/${id}/versions`),
        enabled: !!id,
    });

    // Calculate the next version number based on existing versions
    const currentMaxVersion = versions && versions.length > 0 
        ? Math.max(...versions.map(v => v.version))
        : 0;
    const nextVersion = currentMaxVersion + 1;

    const publishMutation = useMutation({
        mutationFn: () => api.post(`/application-definitions/${id}/publish`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apps', id] });
            queryClient.invalidateQueries({ queryKey: ['app-versions', id] });
            setPublishDialogOpen(false);
        },
        onError: (err: any) => {
            alert('公開に失敗しました: ' + (err.message || 'Unknown error'));
        },
    });

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleDesktopDrawerToggle = () => {
        setDesktopOpen(!desktopOpen);
    };

    const menuItems = [
        { text: '概観 (Overview)', icon: <DashboardIcon />, href: `/designer/apps/${id}` },
        { text: 'フォーム定義', icon: <DescriptionIcon />, href: `/designer/apps/${id}/form` },
        { text: 'フロー定義', icon: <AccountTreeIcon />, href: `/designer/apps/${id}/flow` },
        { text: 'データ検索', icon: <SearchIcon />, href: `/designer/apps/${id}/search` },
        { text: 'バージョン履歴', icon: <HistoryIcon />, href: `/designer/apps/${id}/versions` },
    ];

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!app) {
        return <Box sx={{ p: 3 }}>アプリが見つかりません</Box>;
    }

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Toolbar sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
                <Typography variant="subtitle1" noWrap component="div" fontWeight="bold">
                    App Studio
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="サイドバーを閉じる">
                    <IconButton onClick={handleDesktopDrawerToggle}>
                        <MenuIcon />
                    </IconButton>
                </Tooltip>
            </Toolbar>
            <Divider />
            <List sx={{ flexGrow: 1 }}>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton
                            component={Link}
                            href={item.href}
                            selected={pathname === item.href}
                            sx={{
                                '&.Mui-selected': {
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                    '&:hover': {
                                        bgcolor: 'primary.main',
                                    },
                                    '& .MuiListItemIcon-root': {
                                        color: 'inherit',
                                    },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ color: pathname === item.href ? 'inherit' : 'inherit' }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );

    const currentDrawerWidth = desktopOpen ? drawerWidth : 0;

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
                    ml: { sm: `${currentDrawerWidth}px` },
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    borderBottom: '1px solid #e0e0e0',
                    boxShadow: 'none',
                    transition: 'width 0.2s, margin 0.2s'
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    {/* Desktop Toggle & Back Button */}
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, mr: 2 }}>
                         <Tooltip title="一覧に戻る">
                            <IconButton component={Link} href="/designer/apps" edge="start">
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                        {!desktopOpen && (
                            <Tooltip title="サイドバーを開く">
                                <IconButton onClick={handleDesktopDrawerToggle}>
                                    <MenuIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                    
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6" noWrap component="div">
                            {(app as any)?.name}
                        </Typography>
                        <Chip
                            label={(app as any)?.status === 'ACTIVE' ? '公開中' : '下書き'}
                            color={(app as any)?.status === 'ACTIVE' ? 'success' : 'default'}
                            size="small"
                        />
                         {/* Last Saved Timestamp */}
                         {(app as any)?.updatedAt && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, ml: 2 }}>
                                最終保存: {new Date((app as any).updatedAt).toLocaleString('ja-JP')}
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<PublishIcon />}
                            onClick={() => setPublishDialogOpen(true)}
                            disabled={publishMutation.isPending || !(app as any)?.formDefinition || !(app as any)?.flowDefinition}
                        >
                            {publishMutation.isPending ? '公開処理中...' : '新バージョン公開'}
                        </Button>
                    </Box>
                </Toolbar>
            </AppBar>
            
            <Box
                component="nav"
                sx={{ 
                    width: { sm: currentDrawerWidth }, 
                    flexShrink: { sm: 0 }, 
                    transition: 'width 0.2s' 
                }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { 
                            boxSizing: 'border-box', 
                            width: currentDrawerWidth, 
                            borderRight: desktopOpen ? '1px solid #e0e0e0' : 'none',
                            overflowX: 'hidden',
                            transition: 'width 0.2s'
                        },
                        width: currentDrawerWidth,
                        transition: 'width 0.2s'
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
                    mt: 8, // Toolbar height
                    overflow: 'auto',
                    bgcolor: '#fafafa',
                    transition: 'width 0.2s, margin 0.2s'
                }}
            >
                {children}
            </Box>

            {/* Publishing Dialog - keeping existing code structure ideally but replacing block to keep simple */}
            <Dialog
                open={publishDialogOpen}
                TransitionComponent={Transition}
                keepMounted
                onClose={() => setPublishDialogOpen(false)}
                aria-describedby="alert-dialog-slide-description"
                maxWidth="sm"
                fullWidth
            >
                <Box sx={{ p: 1, textAlign: 'center', mt: 3 }}>
                    <Box sx={{ 
                        display: 'inline-flex', 
                        p: 3, 
                        borderRadius: '50%', 
                        bgcolor: 'success.light', 
                        color: 'success.dark',
                        mb: 2,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                    }}>
                        <RocketLaunchIcon sx={{ fontSize: 60 }} />
                    </Box>
                </Box>
                <DialogTitle sx={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    新しいバージョンを公開しますか？
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            現在の「下書き」の設定を保存し、新しいバージョンとして公開します。
                        </Typography>
                        <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            gap: 2,
                            p: 2,
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            border: '1px dashed #e0e0e0'
                        }}>
                             <Chip label={currentMaxVersion > 0 ? `現在: v${currentMaxVersion}` : '初回公開'} size="small" />
                             <Typography variant="h5" color="text.secondary">→</Typography>
                             <Chip label={`新規: v${nextVersion}`} color="primary" sx={{ fontWeight: 'bold' }} />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                            ※ 公開後は新規申請にこの設定が適用されます。
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, justifyContent: 'center', gap: 2 }}>
                    <Button 
                        onClick={() => setPublishDialogOpen(false)}
                        variant="outlined"
                        size="large"
                        sx={{ borderRadius: 2, px: 4 }}
                    >
                        キャンセル
                    </Button>
                    <Button 
                        onClick={() => publishMutation.mutate()} 
                        variant="contained"
                        size="large"
                        color="success"
                        startIcon={<PublishIcon />}
                        sx={{ 
                            borderRadius: 2, 
                            px: 4,
                            boxShadow: '0 4px 14px rgba(46, 125, 50, 0.4)'
                        }}
                    >
                        公開する
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
