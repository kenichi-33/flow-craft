'use client';

import React, { useState } from 'react';
import { 
    Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, 
    AppBar, Toolbar, Typography, IconButton, Chip, Divider, 
    CircularProgress, Tooltip
} from '@mui/material';
import { useParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

import MenuIcon from '@mui/icons-material/Menu';
import LockIcon from '@mui/icons-material/Lock';

const drawerWidth = 240;

interface AppVersion {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy: string | null;
    formSchema: any;
    flowNodes: any;
    flowEdges: any;
}

export default function VersionAppStudioLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const appId = params?.id as string;
    const versionId = params?.versionId as string;
    const pathname = usePathname();

    const [mobileOpen, setMobileOpen] = useState(false);
    const [desktopOpen, setDesktopOpen] = useState(true);

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

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleDesktopDrawerToggle = () => {
        setDesktopOpen(!desktopOpen);
    };

    const basePath = `/designer/apps/${appId}/versions/${versionId}`;
    const menuItems = [
        { text: '概観 (Overview)', icon: <DashboardIcon />, href: basePath },
        { text: 'フォーム定義', icon: <DescriptionIcon />, href: `${basePath}/form` },
        { text: 'フロー定義', icon: <AccountTreeIcon />, href: `${basePath}/flow` },
    ];

    if (appLoading || versionsLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!app || !version) {
        return <Box sx={{ p: 3 }}>バージョンが見つかりません</Box>;
    }

    const currentDrawerWidth = desktopOpen ? drawerWidth : 0;

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Toolbar sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
                <Typography variant="subtitle1" noWrap component="div" fontWeight="bold">
                    App Studio
                </Typography>
                <Chip 
                    label="読取専用" 
                    size="small" 
                    color="warning" 
                    icon={<LockIcon sx={{ fontSize: 14 }} />}
                    sx={{ ml: 1 }}
                />
            </Toolbar>
            <Divider />
            <List sx={{ flexGrow: 1 }}>
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || 
                        (item.href !== basePath && pathname?.startsWith(item.href));
                    return (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={Link}
                                href={item.href}
                                selected={isActive}
                                sx={{
                                    '&.Mui-selected': {
                                        bgcolor: 'primary.light',
                                        color: 'primary.contrastText',
                                        '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                                        '&:hover': { bgcolor: 'primary.main' }
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
            <Divider />
            <Box sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                    バージョン: v{version.version}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                    公開日: {new Date(version.publishedAt).toLocaleString('ja-JP')}
                </Typography>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ 
            display: 'flex', 
            minHeight: '100vh',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'background.default',
            zIndex: 1200, // Above parent layout
        }}>
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

                    {/* Desktop Toggle */}
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', mr: 2 }}>
                        <Tooltip title={desktopOpen ? "サイドバーを閉じる" : "サイドバーを開く"}>
                            <IconButton onClick={handleDesktopDrawerToggle}>
                                <MenuIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    
                    <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h6" noWrap component="div">
                            {(app as any)?.name}
                        </Typography>
                        <Chip
                            label={`v${version.version}`}
                            color="primary"
                            size="small"
                        />
                        <Chip
                            label="読取専用"
                            color="warning"
                            size="small"
                            variant="outlined"
                            icon={<LockIcon sx={{ fontSize: 14 }} />}
                        />
                    </Box>
                </Toolbar>
            </AppBar>
            
            {/* Mobile Drawer */}
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
            
            {/* Desktop Drawer */}
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
                }}
                open
            >
                {drawer}
            </Drawer>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    ml: { sm: `${currentDrawerWidth}px` },
                    mt: '64px', // AppBar height
                    transition: 'margin 0.2s',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
