'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  alpha,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useAuth } from '@/providers/AuthProvider';


const quickActions = [
  {
    title: '新規申請',
    description: '新しい申請を作成します',
    icon: <AddCircleOutlineIcon sx={{ fontSize: 48 }} />,
    href: '/applications/new',
    color: '#667eea',
    roles: ['wf_user'],
  },
  {
    title: '申請一覧',
    description: '自分の申請を確認します',
    icon: <ListAltIcon sx={{ fontSize: 48 }} />,
    href: '/applications',
    color: '#764ba2',
    roles: ['wf_user'],
  },
  {
    title: 'タスク',
    description: '承認待ちのタスクを処理',
    icon: <AssignmentTurnedInIcon sx={{ fontSize: 48 }} />,
    href: '/tasks',
    color: '#f093fb',
    roles: ['wf_user'],
  },
  {
    title: 'アプリ設計',
    description: 'フォーム・フローを設計',
    icon: <DesignServicesIcon sx={{ fontSize: 48 }} />,
    href: '/designer/apps',
    color: '#4facfe',
    roles: ['wf_manager'],
  },
  {
    title: '管理画面',
    description: '進捗・ユーザー管理',
    icon: <AdminPanelSettingsIcon sx={{ fontSize: 48 }} />,
    href: '/admin',
    color: '#43e97b',
    roles: ['wf_admin'],
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    return roles.some(role => user.roles.includes(role));
  };

  const visibleActions = quickActions.filter(action => hasRole(action.roles));

  if (isLoading) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <Typography>読み込み中...</Typography>
        </Box>
    );
  }

  return (

      <Box
        sx={{
          minHeight: 'calc(100vh - 64px)',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.05) 0%, rgba(118,75,162,0.05) 100%)',
          py: 6,
          width: '100%',
        }}
      >
        <Container maxWidth="lg" sx={{ mx: 'auto' }}>
          {/* ヒーローセクション */}
          <Box
            sx={{
              textAlign: 'center',
              mb: 6,
              p: 4,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              boxShadow: '0 20px 60px rgba(102,126,234,0.3)',
            }}
          >
            <Box
              component="img"
              src="/flow-claft-top.svg"
              alt="Flow Craft"
              sx={{ 
                height: 80,
                mb: 3,
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))'
              }}
            />
            {user && (
              <Typography variant="body1" sx={{ opacity: 0.8 }}>
                ようこそ、{user.username} さん
              </Typography>
            )}
          </Box>

          {/* クイックアクション */}
          <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
            クイックアクション
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 3
          }}>
            {visibleActions.map((action) => (
              <Card
                key={action.title}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: `0 12px 40px ${alpha(action.color, 0.3)}`,
                  },
                  border: '1px solid',
                  borderColor: 'divider',
                }}
                onClick={() => router.push(action.href)}
              >
                <CardContent sx={{ flex: 1, textAlign: 'center', pt: 4 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 2,
                      borderRadius: '50%',
                      background: alpha(action.color, 0.1),
                      color: action.color,
                      mb: 2,
                    }}
                  >
                    {action.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {action.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  <Button
                    variant="contained"
                    sx={{
                      background: `linear-gradient(135deg, ${action.color} 0%, ${alpha(action.color, 0.8)} 100%)`,
                      '&:hover': {
                        background: action.color,
                      },
                    }}
                  >
                    開く
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>

          {/* フッター情報 */}
          <Box sx={{ mt: 6, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              © 2024 Flow Craft - ワークフロー申請システム
            </Typography>
          </Box>
        </Container>
      </Box>
  );
}
