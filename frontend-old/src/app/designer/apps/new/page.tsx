'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Button,
    TextField,
    Paper,
    Typography,
    Alert,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Link from 'next/link';

export default function NewAppPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/application-definitions', data),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['apps'] });
            // 作成後、アプリ詳細画面へ遷移
            router.push(`/designer/apps/${data.id}`);
        },
        onError: (err: any) => {
            setError(err.message || 'アプリの作成に失敗しました');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError('アプリ名は必須です');
            return;
        }

        createMutation.mutate({
            name: name.trim(),
            description: description.trim() || undefined,
            // フォームとフローは後から設定
            formDefinitionId: null,
            flowDefinitionId: null,
        });
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/designer/apps"
                >
                    アプリ一覧に戻る
                </Button>
            </Box>

            <Typography variant="h4" gutterBottom>新規アプリ作成</Typography>
            <Typography color="text.secondary" paragraph>
                まずアプリの基本情報を入力してください。フォームとフローは作成後に設定できます。
            </Typography>

            <Paper sx={{ p: 3, maxWidth: 600 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <TextField
                        label="アプリ名"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                        required
                        placeholder="例: 休暇申請"
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        label="説明"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="例: 有給休暇・特別休暇の申請用アプリ"
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            component={Link}
                            href="/designer/apps"
                        >
                            キャンセル
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? '作成中...' : '作成してフォーム設定へ'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}
