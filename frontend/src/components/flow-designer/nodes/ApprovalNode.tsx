'use client';

import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
    Box, Typography, IconButton, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Chip, FormHelperText, CircularProgress,
    Autocomplete, Tabs, Tab, FormControlLabel, Switch, Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';
import EmailIcon from '@mui/icons-material/Email';
import { api } from '@/lib/api';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function CustomTabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`approval-tabpanel-${index}`}
            aria-labelledby={`approval-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ py: 2 }}>{children}</Box>
            )}
        </div>
    );
}

// 担当者タイプ
type AssigneeType = 'role' | 'group' | 'specific' | 'applicant_manager';

// 選択可能なロール
const AVAILABLE_ROLES = [
    { value: 'wf_user', label: '一般利用者' },
    { value: 'wf_approver', label: '承認者' },
    { value: 'wf_manager', label: '管理職' },
    { value: 'wf_admin', label: 'システム管理者' },
];

// BPMN-style Approval/Task Node (Rounded Rectangle)
export default function ApprovalNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [label, setLabel] = useState(data.label || '承認');
    const [assigneeType, setAssigneeType] = useState<AssigneeType>(data.assigneeType || 'role');
    const [assigneeRole, setAssigneeRole] = useState(data.assigneeRole || 'wf_approver');
    const [assigneeGroup, setAssigneeGroup] = useState(data.assigneeGroup || '');
    const [assigneeGroupDisplay, setAssigneeGroupDisplay] = useState(data.assigneeGroupDisplay || '');  // 部署名表示用
    const [assigneeUser, setAssigneeUser] = useState(data.assigneeUser || '');
    const [availableGroups, setAvailableGroups] = useState<{ value: string; label: string; name: string }[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    // ユーザー検索用
    const [userSearchInput, setUserSearchInput] = useState('');
    const [userOptions, setUserOptions] = useState<{ username: string; displayName: string }[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    // 通知設定
    const [notificationEnabled, setNotificationEnabled] = useState(data.notificationEnabled || false);
    const [notificationSubject, setNotificationSubject] = useState(data.notificationSubject || '【Flow Craft】承認依頼: {{applicationDefinition.name}}');
    const [notificationBody, setNotificationBody] = useState(data.notificationBody || '{{assignee}} 様\n\n申請が届いています。\n確認をお願いします。');
    
    // UI制御
    const [tabValue, setTabValue] = useState(0);
    const { setNodes } = useReactFlow();

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    // ダイアログが開いたときに部署一覧を取得
    useEffect(() => {
        if (dialogOpen && availableGroups.length === 0) {
            setLoadingGroups(true);
            api.get('/users/departments')
                .then((response) => {
                    const departments = response as any[];
                    const groups = departments.map(dept => ({
                        // codeがあればcodeを使用（効率的な比較用）、なければpathを使用
                        value: dept.code || dept.path,
                        label: `${dept.name} (${dept.code || dept.path})`,  // 表示用
                        name: dept.name,  // 部署名（表示用）
                    }));
                    setAvailableGroups(groups);
                })
                .catch((err) => {
                    console.error('Failed to fetch departments:', err);
                    alert('部署一覧の取得に失敗しました。ネットワーク接続を確認してください。');
                    setAvailableGroups([]);
                })
                .finally(() => setLoadingGroups(false));
        }
    }, [dialogOpen, availableGroups.length]);

    // ユーザー検索（debounce付き）
    useEffect(() => {
        if (userSearchInput.length < 2) {
            setUserOptions([]);
            return;
        }

        const timer = setTimeout(() => {
            setLoadingUsers(true);
            api.get(`/users/search?q=${encodeURIComponent(userSearchInput)}&limit=10`)
                .then((response: any) => {
                    const users = response.data || [];
                    setUserOptions(users.map((u: any) => ({
                        username: u.username,
                        displayName: u.displayName || u.username,
                    })));
                })
                .catch((err) => {
                    console.error('Failed to search users:', err);
                    setUserOptions([]);
                })
                .finally(() => setLoadingUsers(false));
        }, 300);

        return () => clearTimeout(timer);
    }, [userSearchInput]);

    const handleSave = () => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            label,
                            assigneeType,
                            assigneeRole: assigneeType === 'role' ? assigneeRole : undefined,
                            assigneeGroup: assigneeType === 'group' ? assigneeGroup : undefined,
                            assigneeUser: assigneeType === 'specific' ? assigneeUser : undefined,
                            // バックエンドで使用する内部値（role:xxx, group:xxx, user:xxx, applicant_manager）
                            assignee: getAssigneeValue(),
                            // 表示用（日本語ラベル）
                            assigneeDisplay: getAssigneeDisplay(),
                            // 通知設定
                            notificationEnabled,
                            notificationSubject,
                            notificationBody,
                        },
                    }
                    : node
            )
        );
        setDialogOpen(false);
    };

    // バックエンドで使用する値
    const getAssigneeValue = () => {
        switch (assigneeType) {
            case 'role':
                return `role:${assigneeRole}`;
            case 'group':
                return `group:${assigneeGroup}`;
            case 'specific':
                return assigneeUser ? `user:${assigneeUser}` : '';
            case 'applicant_manager':
                return 'applicant_manager';
            default:
                return '';
        }
    };

    const getAssigneeDisplay = () => {
        switch (assigneeType) {
            case 'role':
                return AVAILABLE_ROLES.find(r => r.value === assigneeRole)?.label || assigneeRole;
            case 'group':
                // assigneeGroupDisplayに保存された部署名を使用、なければlabelから取得
                return assigneeGroupDisplay || availableGroups.find(g => g.value === assigneeGroup)?.name || assigneeGroup;
            case 'specific':
                return assigneeUser || '指定ユーザー';
            case 'applicant_manager':
                return '申請者の上長';
            default:
                return '';
        }
    };

    const getAssigneeIcon = () => {
        switch (assigneeType) {
            case 'role':
                return <SecurityIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />;
            case 'group':
                return <GroupIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />;
            default:
                return <PersonIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }} />;
        }
    };

    return (
        <>
            <Box
                sx={{
                    minWidth: 140,
                    minHeight: 60,
                    px: 2,
                    py: 1,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #42a5f5 0%, #1976d2 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
                    border: '2px solid rgba(255,255,255,0.5)',
                    position: 'relative',
                }}
            >
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{
                        background: '#1565c0',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {notificationEnabled && <EmailIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, mr: -0.2 }} />}
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'white',
                            fontWeight: 'bold',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}
                    >
                        {data.label || '承認'}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={() => setDialogOpen(true)}
                        onMouseDown={(e) => e.stopPropagation()}
                        sx={{ color: 'white', p: 0.3 }}
                    >
                        <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                </Box>

                {(data.assignee || data.assigneeType) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.5 }}>
                        {getAssigneeIcon()}
                        <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 10 }}
                        >
                            {data.assigneeDisplay || getAssigneeDisplay()}
                        </Typography>
                    </Box>
                )}

                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{
                        background: '#1565c0',
                        width: 10,
                        height: 10,
                        border: '2px solid white',
                    }}
                />
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>承認ステップの設定</DialogTitle>
                <DialogContent>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={tabValue} onChange={handleTabChange} aria-label="approval node settings">
                            <Tab label="基本設定" />
                            <Tab label="通知設定" />
                        </Tabs>
                    </Box>

                    {/* 基本設定タブ */}
                    <CustomTabPanel value={tabValue} index={0}>
                        <TextField
                            label="ステップ名"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            fullWidth
                            sx={{ mt: 1 }}
                            placeholder="例: 部長承認、経理確認"
                        />

                        <FormControl fullWidth sx={{ mt: 3 }}>
                            <InputLabel>担当者の指定方法</InputLabel>
                            <Select
                                value={assigneeType}
                                label="担当者の指定方法"
                                onChange={(e) => setAssigneeType(e.target.value as AssigneeType)}
                            >
                                <MenuItem value="role">ロールで指定</MenuItem>
                                <MenuItem value="group">部署・グループで指定</MenuItem>
                                <MenuItem value="specific">特定ユーザーを指定</MenuItem>
                                <MenuItem value="applicant_manager">申請者の上長</MenuItem>
                            </Select>
                            <FormHelperText>
                                {assigneeType === 'role' && 'このロールを持つユーザーが承認可能'}
                                {assigneeType === 'group' && 'この部署に所属するユーザーが承認可能'}
                                {assigneeType === 'specific' && '指定したユーザーのみ承認可能'}
                                {assigneeType === 'applicant_manager' && '申請者の直属上長が承認'}
                            </FormHelperText>
                        </FormControl>

                        {assigneeType === 'role' && (
                            <FormControl fullWidth sx={{ mt: 2 }}>
                                <InputLabel>必要なロール</InputLabel>
                                <Select
                                    value={assigneeRole}
                                    label="必要なロール"
                                    onChange={(e) => setAssigneeRole(e.target.value)}
                                >
                                    {AVAILABLE_ROLES.map((role) => (
                                        <MenuItem key={role.value} value={role.value}>
                                            <Chip label={role.label} size="small" sx={{ mr: 1 }} />
                                            {role.value}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {assigneeType === 'group' && (
                            <FormControl fullWidth sx={{ mt: 2 }}>
                                <InputLabel>担当部署</InputLabel>
                                <Select
                                    value={assigneeGroup}
                                    label="担当部署"
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setAssigneeGroup(value);
                                        // 選択されたグループのnameを取得して表示用に保存
                                        const selectedGroup = availableGroups.find(g => g.value === value);
                                        setAssigneeGroupDisplay(selectedGroup?.name || '');
                                    }}
                                    disabled={loadingGroups}
                                >
                                    {loadingGroups ? (
                                        <MenuItem disabled>
                                            <CircularProgress size={20} sx={{ mr: 1 }} />
                                            読み込み中...
                                        </MenuItem>
                                    ) : availableGroups.length === 0 ? (
                                        <MenuItem disabled>部署が見つかりません</MenuItem>
                                    ) : (
                                        availableGroups.map((group) => (
                                            <MenuItem key={group.value} value={group.value}>
                                                {group.label}
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                        )}

                        {assigneeType === 'specific' && (
                            <Autocomplete
                                freeSolo
                                options={userOptions}
                                getOptionLabel={(option) => 
                                    typeof option === 'string' ? option : option.username
                                }
                                renderOption={(props, option) => (
                                    <li {...props} key={option.username}>
                                        <Box>
                                            <Typography variant="body2">{option.username}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {option.displayName}
                                            </Typography>
                                        </Box>
                                    </li>
                                )}
                                value={assigneeUser}
                                onChange={(_, newValue) => {
                                    if (typeof newValue === 'string') {
                                        setAssigneeUser(newValue);
                                    } else if (newValue) {
                                        setAssigneeUser(newValue.username);
                                    }
                                }}
                                inputValue={userSearchInput}
                                onInputChange={(_, newInputValue) => {
                                    setUserSearchInput(newInputValue);
                                    if (newInputValue && !userOptions.find(u => u.username === newInputValue)) {
                                        setAssigneeUser(newInputValue);
                                    }
                                }}
                                loading={loadingUsers}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="ユーザー名"
                                        fullWidth
                                        sx={{ mt: 2 }}
                                        placeholder="2文字以上入力して検索"
                                        helperText="Keycloakのユーザー名を入力（自動補完）"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingUsers ? <CircularProgress size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        )}
                    </CustomTabPanel>

                    {/* 通知設定タブ */}
                    <CustomTabPanel value={tabValue} index={1}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={notificationEnabled}
                                    onChange={(e) => setNotificationEnabled(e.target.checked)}
                                />
                            }
                            label="担当者にメール通知を送信する"
                            sx={{ mb: 2, display: 'block' }}
                        />

                        {notificationEnabled && (
                            <>
                                <TextField
                                    label="件名テンプレート"
                                    value={notificationSubject}
                                    onChange={(e) => setNotificationSubject(e.target.value)}
                                    fullWidth
                                    size="small"
                                    sx={{ mb: 2 }}
                                    helperText="変数: {{applicationDefinition.name}}, {{assignee}} など"
                                />
                                <TextField
                                    label="本文テンプレート"
                                    value={notificationBody}
                                    onChange={(e) => setNotificationBody(e.target.value)}
                                    fullWidth
                                    multiline
                                    rows={8}
                                    helperText="申請データは {{fieldName}} で参照可能"
                                />
                            </>
                        )}
                        {!notificationEnabled && (
                            <Typography variant="body2" color="text.secondary">
                                通知機能は無効です。
                            </Typography>
                        )}
                    </CustomTabPanel>

                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>キャンセル</Button>
                    <Button variant="contained" onClick={handleSave}>保存</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
