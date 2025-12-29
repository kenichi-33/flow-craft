'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Button,
    TextField,
    Paper,
    Typography,
    MenuItem,
    Alert,
} from '@mui/material';
import { useRouter } from 'next/navigation';

interface FormDefinition {
    id: string;
    name: string;
}

interface FlowDefinition {
    id: string;
    name: string;
}

export default function NewApplicationDefinitionPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [formDefinitionId, setFormDefinitionId] = useState('');
    const [flowDefinitionId, setFlowDefinitionId] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { data: forms } = useQuery<FormDefinition[]>({
        queryKey: ['forms'],
        queryFn: () => api.get('/forms'),
    });

    const { data: flows } = useQuery<FlowDefinition[]>({
        queryKey: ['flows'],
        queryFn: () => api.get('/flows'),
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/application-definitions', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definitions'] });
            router.push('/designer/applications');
        },
        onError: (err: any) => {
            setError(err.message || 'Failed to create application definition');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name || !formDefinitionId || !flowDefinitionId) {
            setError('名前、フォーム、フローは必須です');
            return;
        }

        createMutation.mutate({
            name,
            description: description || undefined,
            formDefinitionId,
            flowDefinitionId,
        });
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>新規申請アプリ作成</Typography>

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
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        label="説明"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        select
                        label="申請フォーム"
                        value={formDefinitionId}
                        onChange={(e) => setFormDefinitionId(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    >
                        <MenuItem value="">選択してください</MenuItem>
                        {forms?.map((form) => (
                            <MenuItem key={form.id} value={form.id}>
                                {form.name}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label="承認フロー"
                        value={flowDefinitionId}
                        onChange={(e) => setFlowDefinitionId(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 3 }}
                    >
                        <MenuItem value="">選択してください</MenuItem>
                        {flows?.map((flow) => (
                            <MenuItem key={flow.id} value={flow.id}>
                                {flow.name}
                            </MenuItem>
                        ))}
                    </TextField>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={() => router.back()}
                        >
                            キャンセル
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? '作成中...' : '作成'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
}
