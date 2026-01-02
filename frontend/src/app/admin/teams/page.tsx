'use client';

import React, { useState } from 'react';
import {
    Box, Paper, Typography, Button, List, ListItem, ListItemButton, ListItemIcon,
    ListItemText, Chip, Divider, Tabs, Tab, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, IconButton, Card, CardContent, CardActions,
    Alert, CircularProgress, Avatar
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderIcon from '@mui/icons-material/Folder';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useAuth } from '@/providers/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Department {
    path: string;
    name: string;
}

interface Team {
    id: string;
    name: string;
    description?: string;
    members: { id: string; memberType: string; memberId: string }[];
}

// 部署タブ（Keycloak APIから取得）
function DepartmentsTab() {
    const { data: departments, isLoading } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: () => api.get('/users/departments'),
    });

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
                部署は会社の組織構造を表します。変更はKeycloak管理コンソールから行ってください。
            </Alert>
            {(!departments || departments.length === 0) ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                    部署が登録されていません
                </Typography>
            ) : (
                <List>
                    {departments.map((dept) => (
                        <ListItem key={dept.path} disablePadding>
                            <ListItemButton>
                                <ListItemIcon>
                                    {dept.path === '/Company' ? (
                                        <BusinessIcon color="primary" />
                                    ) : (
                                        <FolderIcon color="action" />
                                    )}
                                </ListItemIcon>
                                <ListItemText
                                    primary={dept.name}
                                    secondary={dept.path}
                                    sx={{ pl: (dept.path.split('/').length - 2) * 2 }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}

// チームタブ
function TeamsTab() {
    const queryClient = useQueryClient();
    const { hasRole } = useAuth();
    const isAdmin = hasRole('wf_admin');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDescription, setNewTeamDescription] = useState('');
    const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [newMemberId, setNewMemberId] = useState('');
    const [newMemberType, setNewMemberType] = useState<'user' | 'department'>('user');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: teams, isLoading } = useQuery<Team[]>({
        queryKey: ['teams'],
        queryFn: () => api.get('/teams'),
    });

    // ユーザー検索
    const { data: searchResults, isFetching: isSearching } = useQuery<any[]>({
        queryKey: ['user-search', searchQuery],
        queryFn: () => api.get(`/users/search?q=${encodeURIComponent(searchQuery)}&limit=20`).then((res: any) => res.data || res),
        enabled: searchQuery.length > 0,
    });

    // 部署一覧
    const { data: departments } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: () => api.get('/users/departments'),
    });

    const createMutation = useMutation({
        mutationFn: (data: { name: string; description?: string }) => api.post('/teams', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            setCreateDialogOpen(false);
            setNewTeamName('');
            setNewTeamDescription('');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/teams/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams'] });
        },
    });

    const addMemberMutation = useMutation({
        mutationFn: (data: { teamId: string; memberType: string; memberId: string }) =>
            api.post(`/teams/${data.teamId}/members`, { memberType: data.memberType, memberId: data.memberId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            setAddMemberDialogOpen(false);
            setNewMemberId('');
            setSearchQuery('');
        },
    });

    const removeMemberMutation = useMutation({
        mutationFn: (data: { teamId: string; memberId: string }) =>
            api.delete(`/teams/${data.teamId}/members/${data.memberId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams'] });
        },
    });

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
                チームはプロジェクトや業務グループなど、任意に作成できるグループです。部署やユーザーを自由に追加できます。
            </Alert>

            {isAdmin && (
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                    sx={{ mb: 2 }}
                >
                    新規チーム作成
                </Button>
            )}

            {(!teams || teams.length === 0) ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                    チームがまだ作成されていません
                </Typography>
            ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {teams.map((team) => (
                        <Card key={team.id} sx={{ width: 300, borderRadius: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <GroupIcon color="primary" />
                                    <Typography variant="h6" fontWeight={600}>
                                        {team.name}
                                    </Typography>
                                </Box>
                                {team.description && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {team.description}
                                    </Typography>
                                )}
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    メンバー ({team.members?.length || 0})
                                </Typography>
                                {team.members && team.members.length > 0 ? (
                                    <List dense>
                                        {team.members.map((member) => (
                                            <ListItem
                                                key={member.id}
                                                secondaryAction={
                                                    isAdmin && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => removeMemberMutation.mutate({
                                                                teamId: team.id,
                                                                memberId: member.memberId,
                                                            })}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    )
                                                }
                                            >
                                                <ListItemIcon sx={{ minWidth: 32 }}>
                                                    {member.memberType === 'user' ? (
                                                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                                                            {member.memberId[0].toUpperCase()}
                                                        </Avatar>
                                                    ) : (
                                                        <FolderIcon fontSize="small" />
                                                    )}
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={member.memberId}
                                                    secondary={member.memberType === 'user' ? 'ユーザー' : '部署'}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        メンバーなし
                                    </Typography>
                                )}
                            </CardContent>
                            {isAdmin && (
                                <CardActions>
                                    <Button
                                        size="small"
                                        startIcon={<PersonAddIcon />}
                                        onClick={() => {
                                            setSelectedTeamId(team.id);
                                            setAddMemberDialogOpen(true);
                                        }}
                                    >
                                        追加
                                    </Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => deleteMutation.mutate(team.id)}
                                    >
                                        削除
                                    </Button>
                                </CardActions>
                            )}
                        </Card>
                    ))}
                </Box>
            )}

            {/* 新規チーム作成ダイアログ */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>新規チーム作成</DialogTitle>
                <DialogContent>
                    <TextField
                        label="チーム名"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        fullWidth
                        sx={{ mt: 2 }}
                    />
                    <TextField
                        label="説明（任意）"
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>キャンセル</Button>
                    <Button
                        variant="contained"
                        onClick={() => createMutation.mutate({
                            name: newTeamName,
                            description: newTeamDescription || undefined,
                        })}
                        disabled={!newTeamName || createMutation.isPending}
                    >
                        作成
                    </Button>
                </DialogActions>
            </Dialog>

            {/* メンバー追加ダイアログ */}
            <Dialog open={addMemberDialogOpen} onClose={() => setAddMemberDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>メンバー追加</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button
                            variant={newMemberType === 'user' ? 'contained' : 'outlined'}
                            onClick={() => { setNewMemberType('user'); setNewMemberId(''); setSearchQuery(''); }}
                        >
                            ユーザー
                        </Button>
                        <Button
                            variant={newMemberType === 'department' ? 'contained' : 'outlined'}
                            onClick={() => { setNewMemberType('department'); setNewMemberId(''); setSearchQuery(''); }}
                        >
                            部署
                        </Button>
                    </Box>

                    {newMemberType === 'user' ? (
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                label="ユーザー検索"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                fullWidth
                                placeholder="名前またはユーザー名で検索..."
                                autoComplete="off"
                            />
                            {searchQuery.length > 0 && (
                                <Paper sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}>
                                    {isSearching ? (
                                        <Box sx={{ p: 2, textAlign: 'center' }}>
                                            <CircularProgress size={20} />
                                        </Box>
                                    ) : searchResults && searchResults.length > 0 ? (
                                        <List dense>
                                            {searchResults.map((user: any) => (
                                                <ListItem
                                                    key={user.username}
                                                    disablePadding
                                                    sx={{
                                                        bgcolor: newMemberId === user.username ? 'action.selected' : 'inherit',
                                                    }}
                                                >
                                                    <ListItemButton onClick={() => setNewMemberId(user.username)}>
                                                        <ListItemIcon>
                                                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.9rem' }}>
                                                                {user.displayName?.[0] || user.username[0].toUpperCase()}
                                                            </Avatar>
                                                        </ListItemIcon>
                                                        <ListItemText
                                                            primary={user.displayName || user.username}
                                                            secondary={`${user.username} - ${user.groups?.[0] || ''}`}
                                                        />
                                                        {newMemberId === user.username && (
                                                            <Chip label="選択中" size="small" color="primary" />
                                                        )}
                                                    </ListItemButton>
                                                </ListItem>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography color="text.secondary" sx={{ p: 2 }}>
                                            該当するユーザーが見つかりません
                                        </Typography>
                                    )}
                                </Paper>
                            )}
                            {newMemberId && (
                                <Box sx={{ mt: 2, p: 1, bgcolor: 'action.selected', borderRadius: 1 }}>
                                    <Typography variant="body2">
                                        <strong>選択中:</strong> {newMemberId}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                部署を選択してください
                            </Typography>
                            <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                                {(departments || []).map((dept) => (
                                    <ListItem
                                        key={dept.path}
                                        disablePadding
                                        sx={{
                                            bgcolor: newMemberId === dept.path ? 'action.selected' : 'inherit',
                                        }}
                                    >
                                        <ListItemButton onClick={() => setNewMemberId(dept.path)}>
                                            <ListItemIcon>
                                                <FolderIcon />
                                            </ListItemIcon>
                                            <ListItemText primary={dept.name} secondary={dept.path} />
                                            {newMemberId === dept.path && (
                                                <Chip label="選択中" size="small" color="primary" />
                                            )}
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddMemberDialogOpen(false)}>キャンセル</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (selectedTeamId) {
                                addMemberMutation.mutate({
                                    teamId: selectedTeamId,
                                    memberType: newMemberType,
                                    memberId: newMemberId,
                                });
                            }
                        }}
                        disabled={!newMemberId || addMemberMutation.isPending}
                    >
                        追加
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default function TeamsPage() {
    const [tabValue, setTabValue] = useState(0);

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/admin"
                    sx={{ color: '#667eea' }}
                >
                    ダッシュボードに戻る
                </Button>
            </Box>

            <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h5" fontWeight={700} color="primary" sx={{ mb: 2 }}>
                    組織・チーム管理
                </Typography>

                <Tabs
                    value={tabValue}
                    onChange={(_, v) => setTabValue(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
                >
                    <Tab icon={<BusinessIcon />} iconPosition="start" label="部署（組織）" />
                    <Tab icon={<GroupIcon />} iconPosition="start" label="チーム（任意）" />
                </Tabs>

                {tabValue === 0 && <DepartmentsTab />}
                {tabValue === 1 && <TeamsTab />}
            </Paper>
        </Box>
    );
}
