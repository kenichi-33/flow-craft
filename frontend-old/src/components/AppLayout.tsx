'use client';

import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SettingsIcon from '@mui/icons-material/Settings';
import GroupIcon from '@mui/icons-material/Group';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import { Avatar, Chip, Menu, MenuItem, Tooltip, CircularProgress } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { UserDisplay } from './UserDisplay';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
    open?: boolean;
}>(({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    minWidth: 0, // Prevent flex item overflow
    transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
    }),
}));

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
    transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    const [open, setOpen] = React.useState(true);
    const pathname = usePathname();
    const { user, isLoading, logout, hasRole } = useAuth();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        handleMenuClose();
        logout();
    };

    // ロールに応じてメニューをフィルター
    const menuItems = [
        // 利用者向け
        {
            section: '利用者', items: [
                { text: 'トップ', icon: <HomeIcon />, href: '/' },
                { text: '新規申請', icon: <EditNoteIcon />, href: '/applications/new' },
                { text: '申請一覧', icon: <DescriptionIcon />, href: '/applications' },
                { text: 'タスク', icon: <DashboardIcon />, href: '/tasks' },
            ]
        },
        // 設計者向け（wf_admin or wf_manager）
        ...(hasRole('wf_manager') ? [{
            section: '設計者', items: [
                { text: 'アプリ管理', icon: <SettingsIcon />, href: '/designer/apps' },
            ]
        }] : []),
        // 管理者向け（wf_admin or wf_manager）
        ...(hasRole('wf_manager') ? [{
            section: '管理者', items: [
                { text: 'ダッシュボード', icon: <DashboardIcon />, href: '/admin' },
                { text: '進捗一覧', icon: <AccountTreeIcon />, href: '/admin/workflows' },
                { text: 'タスク管理', icon: <SettingsIcon />, href: '/admin/tasks' },
                ...(hasRole('wf_admin') ? [
                    { text: 'チーム管理', icon: <GroupIcon />, href: '/admin/teams' },
                    { text: 'ユーザー管理', icon: <PeopleIcon />, href: '/admin/users' },
                ] : []),
            ]
        }] : []),
    ];

    // App Studio (デザイナー画面) の場合はグローバルレイアウトを無効化し、
    // 各画面（layout.tsx）で独自のシェルを提供する（Double Sidebar防止）
    const isStudioRoute = pathname?.match(/^\/designer\/apps\/[^/]+/) && pathname !== '/designer/apps';

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (isStudioRoute) {
        return <>{children}</>;
    }

    return (
        <Box sx={{ display: 'flex' }}>

            <AppBar position="fixed" open={open}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{ mr: 2, ...(open && { display: 'none' }) }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
                        <Box
                            component="img"
                            src="/flow-claft-top.svg"
                            alt="Flow Craft"
                            sx={{ height: 40 }}
                        />
                    </Box>
                    {user && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {user.roles.includes('wf_admin') && (
                                <Chip label="管理者" size="small" color="error" />
                            )}
                            {user.roles.includes('wf_manager') && !user.roles.includes('wf_admin') && (
                                <Chip label="管理職" size="small" color="warning" />
                            )}
                            {user.roles.includes('wf_approver') && !user.roles.includes('wf_manager') && (
                                <Chip label="承認者" size="small" color="info" />
                            )}
                            <Tooltip title={user.email}>
                                <IconButton onClick={handleMenuOpen} size="small">
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#667eea' }}>
                                        {user.firstName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase()}
                                    </Avatar>
                                </IconButton>
                            </Tooltip>
                            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                <UserDisplay 
                                    user={{
                                        ...user,
                                        department: user.groups?.[0] // Simple mapping for header
                                    }} 
                                    fallback={user.username} 
                                />
                            </Box>
                            <Tooltip title="ログアウト">
                                <IconButton onClick={handleLogout} size="small" color="inherit">
                                    <LogoutIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={handleMenuClose}
                            >
                                <MenuItem disabled>
                                    <Typography variant="body2" color="text.secondary">
                                        {user.email}
                                    </Typography>
                                </MenuItem>
                            </Menu>
                        </Box>
                    )}
                </Toolbar>
            </AppBar>
            <Drawer
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                    },
                }}
                variant="persistent"
                anchor="left"
                open={open}
            >
                <DrawerHeader>
                    <IconButton onClick={handleDrawerClose}>
                        {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </DrawerHeader>
                <Divider />
                <List>
                    {menuItems.map((group) => (
                        <React.Fragment key={group.section}>
                            <ListItem sx={{ pt: 2, pb: 0 }}>
                                <Typography variant="overline" color="text.secondary">
                                    {group.section}
                                </Typography>
                            </ListItem>
                            {group.items.map((item) => (
                                <ListItem key={item.text} disablePadding>
                                    <ListItemButton component={Link} href={item.href} selected={pathname === item.href || pathname?.startsWith(item.href + '/')}>
                                        <ListItemIcon>
                                            {item.icon}
                                        </ListItemIcon>
                                        <ListItemText primary={item.text} />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </React.Fragment>
                    ))}
                </List>
            </Drawer>
            <Main open={open}>
                <DrawerHeader />
                {children}
            </Main>
        </Box>
    );
}
