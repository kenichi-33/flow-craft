'use client';

import React from 'react';
import { Box, Typography, Divider, Chip, Paper } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';
import EmailIcon from '@mui/icons-material/Email';

interface FlowPropertyPanelProps {
    node: any | null;
}

// Helper to render role labels (matching ApprovalNode logic)
const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
        'wf_user': '一般利用者',
        'wf_approver': '承認者',
        'wf_manager': '管理職',
        'wf_admin': 'システム管理者'
    };
    return roles[role] || role;
};

export default function FlowPropertyPanel({ node }: FlowPropertyPanelProps) {
    if (!node) {
        return (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="body2">
                    フロー上のノードを選択すると<br />詳細設定が表示されます
                </Typography>
            </Box>
        );
    }

    const { type, data } = node;

    // Common header
    const renderHeader = (title: string, subtitle?: string) => (
        <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Typography variant="subtitle1" fontWeight="bold">
                {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {subtitle || 'プロパティ設定'}
            </Typography>
        </Box>
    );

    // Approval Node Details
    if (type === 'approval') {
        const assigneeType = data.assigneeType || 'role';
        const assigneeRole = data.assigneeRole;
        const assigneeGroup = data.assigneeGroup;
        const specificEmails = data.specificEmails;

        return (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
                {renderHeader('承認タスク', data.label)}
                <Box sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        担当者設定
                    </Typography>
                    
                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            {assigneeType === 'role' && <SecurityIcon color="action" />}
                            {assigneeType === 'group' && <GroupIcon color="action" />}
                            {assigneeType === 'specific' && <PersonIcon color="action" />}
                            {assigneeType === 'applicant_manager' && <PersonIcon color="action" />}
                            
                            <Typography variant="body2" fontWeight="bold">
                                {assigneeType === 'role' && 'ロール指定'}
                                {assigneeType === 'group' && 'グループ指定'}
                                {assigneeType === 'specific' && '特定ユーザー'}
                                {assigneeType === 'applicant_manager' && '申請者の上長'}
                            </Typography>
                        </Box>

                        {assigneeType === 'role' && (
                            <Typography variant="body2">
                                {getRoleLabel(assigneeRole)}
                            </Typography>
                        )}

                        {assigneeType === 'group' && (
                            <Typography variant="body2">
                                グループID: {assigneeGroup || '(未設定)'}
                            </Typography>
                        )}

                        {assigneeType === 'specific' && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {specificEmails ? (
                                    specificEmails.split(',').map((email: string) => (
                                        <Chip 
                                            key={email} 
                                            label={email.trim()} 
                                            size="small" 
                                            icon={<EmailIcon />} 
                                            variant="outlined"
                                        />
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary">未設定</Typography>
                                )}
                            </Box>
                        )}
                        
                        {assigneeType === 'applicant_manager' && (
                            <Typography variant="caption" color="text.secondary">
                                申請者の上長が自動で割り当てられます
                            </Typography>
                        )}
                    </Paper>

                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        その他の設定
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">メール通知</Typography>
                            <Chip label={data.enableEmailNotification ? 'ON' : 'OFF'} size="small" color={data.enableEmailNotification ? 'success' : 'default'} />
                        </Box>
                        {data.enableEmailNotification && (
                            <Box sx={{ pl: 1, borderLeft: '2px solid #eee' }}>
                                <Typography variant="caption" display="block">件名: {data.emailSubject || '(デフォルト)'}</Typography>
                            </Box>
                        )}
                    </Box>
                    
                </Box>
            </Box>
        );
    }

    // Branch Node Details
    if (type === 'branch') {
        const opLabel = (op: string) => {
            switch(op) {
                case '==': return 'と等しい (=)';
                case '!=': return 'と等しくない (≠)';
                case '>': return 'より大きい (>)';
                case '<': return 'より小さい (<)';
                default: return op;
            }
        };

        return (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
                {renderHeader('条件分岐 (XOR)', data.label)}
                <Box sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        分岐条件
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="body2" gutterBottom>
                            <strong>対象フィールド:</strong> {data.conditionField || '(未設定)'}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                            <strong>条件:</strong> {opLabel(data.conditionOperator)}
                        </Typography>
                        <Typography variant="body2">
                            <strong>値:</strong> {data.conditionValue || '(空)'}
                        </Typography>
                    </Paper>

                    <Box sx={{ mt: 2 }}>
                         <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                            ルートラベル
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Chip label={`Yes: ${data.yesLabel || 'はい'}`} color="primary" variant="outlined" />
                            <Chip label={`No: ${data.noLabel || 'いいえ'}`} color="default" variant="outlined" />
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }

    // API Call Node Details
    if (type === 'apiCall') {
        return (
            <Box sx={{ height: '100%', overflow: 'auto' }}>
                {renderHeader('API呼び出し', data.label)}
                <Box sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        リクエスト設定
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                            <Chip label={data.method || 'GET'} size="small" color="primary" variant="outlined" />
                            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                {data.url || '(URL未設定)'}
                            </Typography>
                        </Box>
                        
                        <Divider sx={{ my: 1 }} />
                        
                        <Typography variant="caption" display="block" gutterBottom>ヘッダー:</Typography>
                        {data.headers && data.headers !== '{}' ? (
                            <pre style={{ margin: 0, fontSize: '0.75rem', backgroundColor: '#f5f5f5', padding: '4px' }}>
                                {data.headers}
                            </pre>
                        ) : (
                            <Typography variant="caption" color="text.secondary">未設定</Typography>
                        )}

                        <Divider sx={{ my: 1 }} />

                        <Typography variant="caption" display="block" gutterBottom>ボディ:</Typography>
                        {data.body && data.body !== '{}' ? (
                            <pre style={{ margin: 0, fontSize: '0.75rem', backgroundColor: '#f5f5f5', padding: '4px', whiteSpace: 'pre-wrap' }}>
                                {typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2)}
                            </pre>
                        ) : (
                            <Typography variant="caption" color="text.secondary">未設定</Typography>
                        )}
                    </Paper>

                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        レスポンス処理
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="body2" gutterBottom>
                            <strong>成功コード:</strong> {data.successCodes || '200,201,204'}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                            <strong>エラー時:</strong> {data.errorBehavior === 'continue' ? '続行' : '停止'}
                        </Typography>
                        
                        <Divider sx={{ my: 1 }} />
                        
                        <Typography variant="caption" display="block" gutterBottom>マッピング:</Typography>
                         {data.responseMapping && data.responseMapping !== '{}' ? (
                            <pre style={{ margin: 0, fontSize: '0.75rem', backgroundColor: '#f5f5f5', padding: '4px' }}>
                                {data.responseMapping}
                            </pre>
                        ) : (
                            <Typography variant="caption" color="text.secondary">未設定</Typography>
                        )}
                    </Paper>
                </Box>
            </Box>
        );
    }

    // Default View (Fallback)
    return (
        <Box sx={{ height: '100%', overflow: 'auto' }}>
            {renderHeader(data.label || type)}
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                    プロパティの詳細:
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f5f5f5', overflowX: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </Paper>
            </Box>
        </Box>
    );
}
