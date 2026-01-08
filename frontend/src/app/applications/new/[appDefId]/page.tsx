'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Button,
    Alert,
    Divider,
    Card,
    CardContent,
    Stepper,
    Step,
    StepLabel,
    Chip,
    LinearProgress,
    Grid,
    TextField,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Checkbox,
    Select,
    MenuItem,
    InputLabel,
    FormGroup,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Link from 'next/link';
import FlowVisualization from '@/components/flow-designer/FlowVisualization';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
    formDefinition: {
        id: string;
        name: string;
        schema: any;
    };
    flowDefinition?: {
        id: string;
        name: string;
        nodes: any[];
        edges: any[];
    };
}

interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface FieldDef {
    type: string;
    title: string;
    options?: string[];
    required?: boolean;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    helperText?: string;
}

// Custom styled components for consistent premium look
const inputStyle = {
    '& .MuiInputBase-root': {
        bgcolor: '#f8f9fa',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
            bgcolor: '#fff',
            borderColor: '#bkc',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        },
        '&.Mui-focused': {
            bgcolor: '#fff',
            borderColor: '#3a1c71',
            boxShadow: '0 0 0 3px rgba(58, 28, 113, 0.1)',
        }
    },
    '& .MuiInputBase-input': {
        padding: '12px 16px',
    },
    '& .MuiInputLabel-root': {
        transform: 'translate(14px, 12px) scale(1)',
        '&.Mui-focused, &.MuiFormLabel-filled': {
            transform: 'translate(14px, -9px) scale(0.75)',
            fontWeight: 'bold',
            color: '#3a1c71',
        }
    }
};

const selectionCardStyle = {
    flex: 1,
    minWidth: '150px',
    m: 0.5,
    p: 1.5,
    borderRadius: 3,
    border: '1px solid #edf2f7',
    transition: 'all 0.2s',
    bgcolor: '#f8f9fa',
    '&:hover': {
        bgcolor: '#fff',
        borderColor: '#cbd5e0',
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    },
    '&:has(.Mui-checked)': {
        bgcolor: '#f0f5ff',
        borderColor: '#3a1c71',
        boxShadow: '0 4px 12px rgba(58, 28, 113, 0.1)'
    }
};

export default function SubmitApplicationPage() {
    const router = useRouter();
    const params = useParams();
    const appDefId = params.appDefId as string;

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: appDef, isLoading } = useQuery<ApplicationDefinition>({
        queryKey: ['app-def-published', appDefId],
        queryFn: () => api.get(`/application-definitions/${appDefId}/published`),
        enabled: !!appDefId,
    });

    const submitMutation = useMutation({
        mutationFn: (data: any) => {
            const titleInput = document.getElementById('application-title') as HTMLInputElement;
            const title = titleInput?.value || '無題';
            return api.post('/workflow/start', {
                applicationDefinitionId: appDefId,
                title,
                inputData: data,
            });
        },
        onSuccess: (result: any) => {
            router.push(`/applications/${result.id}`);
        },
        onError: (err: any) => {
            setError(err.message || '申請に失敗しました');
            setIsSubmitting(false);
        },
    });

    // 一時保存用のmutation
    const saveDraftMutation = useMutation({
        mutationFn: (data: any) => {
            const titleInput = document.getElementById('application-title') as HTMLInputElement;
            const title = titleInput?.value || '無題';
            return api.post('/workflow/save-draft', {
                applicationDefinitionId: appDefId,
                title,
                inputData: data,
            });
        },
        onSuccess: (result: any) => {
            router.push(`/applications/${result.id}`);
        },
        onError: (err: any) => {
            setError(err.message || '一時保存に失敗しました');
        },
    });

    if (isLoading) {
        return (
            <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
                <LinearProgress />
                <Typography sx={{ mt: 2, textAlign: 'center' }}>読み込み中...</Typography>
            </Box>
        );
    }

    if (!appDef) {
        return (
            <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
                <Alert severity="error">アプリが見つかりません</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            py: 4,
        }}>
            <Box sx={{ maxWidth: 1200, mx: 'auto', px: 2 }}>
                {/* Header Card */}
                <Card sx={{
                    mb: 3,
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Button
                                startIcon={<ArrowBackIcon />}
                                component={Link}
                                href="/applications/new"
                                variant="outlined"
                                size="small"
                            >
                                戻る
                            </Button>
                            <Chip
                                icon={<DescriptionIcon />}
                                label="新規申請"
                                color="primary"
                                variant="outlined"
                            />
                        </Box>
                        <Typography variant="h4" fontWeight="bold" gutterBottom>
                            {appDef.name}
                        </Typography>
                        {appDef.description && (
                            <Typography color="text.secondary">
                                {appDef.description}
                            </Typography>
                        )}
                    </CardContent>
                </Card>

                {/* Progress Stepper */}
                <Card sx={{
                    mb: 3,
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}>
                    <CardContent>
                        <Stepper activeStep={0} alternativeLabel>
                            <Step>
                                <StepLabel>入力</StepLabel>
                            </Step>
                            <Step>
                                <StepLabel>確認</StepLabel>
                            </Step>
                            <Step>
                                <StepLabel>完了</StepLabel>
                            </Step>
                        </Stepper>
                    </CardContent>
                </Card>

                {/* Flow Progress */}
                {appDef?.flowDefinition && (
                    <Card sx={{
                        mb: 3,
                        borderRadius: 3,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <AccountTreeIcon color="primary" />
                                <Typography variant="h6" fontWeight="bold">
                                    承認フロー
                                </Typography>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Box sx={{ height: 300, bgcolor: '#fafafa', borderRadius: 2 }}>
                                <FlowVisualization
                                    nodes={appDef.flowDefinition.nodes}
                                    edges={appDef.flowDefinition.edges}
                                    currentNodeId={null}
                                    height={300}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* Form Card */}
                <Card sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}>
                    <CardContent sx={{ p: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                            <CheckCircleIcon color="primary" />
                            <Typography variant="h6" fontWeight="bold">
                                申請フォーム
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 3 }} />

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        <Box sx={{ mb: 4 }}>
                            <TextField
                                fullWidth
                                required
                                label="件名"
                                placeholder="申請の件名を入力してください"
                                sx={inputStyle}
                                name="title"
                                id="application-title"
                            />
                        </Box>

                        <DynamicFormRenderer 
                            schema={appDef.formDefinition.schema}
                            onSubmit={(data) => {
                                setIsSubmitting(true);
                                submitMutation.mutate(data);
                            }}
                            renderActions={(methods) => (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                    <Button
                                        variant="outlined"
                                        component={Link}
                                        href="/applications/new"
                                        sx={{ borderRadius: 2 }}
                                    >
                                        キャンセル
                                    </Button>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<SaveIcon />}
                                            onClick={() => {
                                                const data = methods.getValues();
                                                saveDraftMutation.mutate(data);
                                            }}
                                            disabled={saveDraftMutation.isPending}
                                            sx={{ borderRadius: 2, px: 3 }}
                                        >
                                            {saveDraftMutation.isPending ? '保存中...' : '下書き保存'}
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            size="large"
                                            startIcon={<SendIcon />}
                                            disabled={isSubmitting}
                                            sx={{
                                                borderRadius: 2,
                                                px: 4,
                                                py: 1.5,
                                                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                                                boxShadow: '0 3px 5px 2px rgba(102, 126, 234, .3)',
                                            }}
                                        >
                                            {isSubmitting ? '送信中...' : '申請する'}
                                        </Button>
                                    </Box>
                                </Box>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Footer */}
                <Typography
                    variant="caption"
                    sx={{
                        display: 'block',
                        textAlign: 'center',
                        mt: 3,
                        color: 'rgba(255,255,255,0.7)'
                    }}
                >
                    Flow Craft - ワークフロー管理システム
                </Typography>
            </Box>
        </Box>
    );
}
