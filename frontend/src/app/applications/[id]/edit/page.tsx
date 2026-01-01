'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import EditIcon from '@mui/icons-material/Edit';
import Link from 'next/link';

interface ApplicationDetail {
    id: string;
    applicationNumber: number;
    status: string;
    inputData: any;
    applicantId: string;
    applicationDefinition?: {
        id: string;
        name: string;
        description?: string;
    };
    formDefinition?: {
        schema: any;
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

export default function EditApplicationPage() {
    const router = useRouter();
    const params = useParams();
    const applicationId = params.id as string;

    const [formData, setFormData] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: application, isLoading } = useQuery<ApplicationDetail>({
        queryKey: ['application-for-edit', applicationId],
        queryFn: () => api.get(`/workflow/applications/${applicationId}/status`),
        enabled: !!applicationId,
    });

    // Initialize form data from existing application
    useEffect(() => {
        if (application?.inputData) {
            setFormData(application.inputData);
        }
    }, [application]);

    const resubmitMutation = useMutation({
        mutationFn: (data: any) => api.post(`/workflow/applications/${applicationId}/resubmit`, {
            inputData: data,
        }),
        onSuccess: () => {
            router.push(`/applications/${applicationId}`);
        },
        onError: (err: any) => {
            setError(err.message || '再送信に失敗しました');
            setIsSubmitting(false);
        },
    });

    // Get layout-sorted fields
    const sortedFields = useMemo(() => {
        const schema = application?.formDefinition?.schema;
        if (!schema?.properties) return [];

        const properties = schema.properties as Record<string, FieldDef>;
        const layout: LayoutItem[] = schema['x-layout'] || [];
        const required: string[] = schema.required || [];

        const fields = Object.entries(properties)
            .map(([id, prop]) => {
                const layoutItem = layout.find(l => l.i === id);
                return {
                    id,
                    ...prop,
                    required: required.includes(id) || prop.required === true,
                    x: layoutItem?.x ?? 0,
                    y: layoutItem?.y ?? 0,
                    w: layoutItem?.w ?? 12,
                    h: layoutItem?.h ?? 1,
                };
            });

        fields.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        return fields;
    }, [application]);

    // Group fields by row
    const rows = useMemo(() => {
        const rowMap: Record<number, typeof sortedFields> = {};
        for (const field of sortedFields) {
            if (!rowMap[field.y]) rowMap[field.y] = [];
            rowMap[field.y].push(field);
        }
        return Object.entries(rowMap)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, fields]) => fields.sort((a, b) => a.x - b.x));
    }, [sortedFields]);

    // Validate form data
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        for (const field of sortedFields) {
            const value = formData[field.id];

            if (['divider', 'label'].includes(field.type)) continue;

            if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
                newErrors[field.id] = `${field.title}は必須です`;
                continue;
            }

            if (value && typeof value === 'string') {
                if (field.pattern) {
                    const regex = new RegExp(field.pattern);
                    if (!regex.test(value)) {
                        newErrors[field.id] = `${field.title}の形式が正しくありません`;
                        continue;
                    }
                }

                if (field.minLength && value.length < field.minLength) {
                    newErrors[field.id] = `${field.title}は${field.minLength}文字以上で入力してください`;
                    continue;
                }

                if (field.maxLength && value.length > field.maxLength) {
                    newErrors[field.id] = `${field.title}は${field.maxLength}文字以下で入力してください`;
                    continue;
                }
            }

            if (field.type === 'number' && value !== '' && value !== undefined) {
                const numValue = Number(value);
                if (field.min !== undefined && numValue < field.min) {
                    newErrors[field.id] = `${field.title}は${field.min}以上で入力してください`;
                    continue;
                }
                if (field.max !== undefined && numValue > field.max) {
                    newErrors[field.id] = `${field.title}は${field.max}以下で入力してください`;
                    continue;
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm()) {
            setError('入力内容にエラーがあります。修正してください。');
            return;
        }

        setIsSubmitting(true);
        resubmitMutation.mutate(formData);
    };

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const renderField = (field: any) => {
        const value = formData[field.id] ?? '';
        const gridWidth = Math.min(12, Math.max(1, field.w));
        const fieldError = errors[field.id];

        if (field.type === 'divider') {
            return (
                <Grid key={field.id} size={12}>
                    <Divider sx={{ my: 1 }} />
                </Grid>
            );
        }

        if (field.type === 'label') {
            return (
                <Grid key={field.id} size={12}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                        {field.title}
                    </Typography>
                </Grid>
            );
        }

        const fieldElement = (() => {
            switch (field.type) {
                case 'text':
                    return (
                        <TextField
                            label={field.title}
                            fullWidth
                            value={value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            error={!!fieldError}
                            helperText={fieldError || field.helperText}
                        />
                    );
                case 'textarea':
                    return (
                        <TextField
                            label={field.title}
                            fullWidth
                            multiline
                            rows={3}
                            value={value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            error={!!fieldError}
                            helperText={fieldError || field.helperText}
                        />
                    );
                case 'number':
                    return (
                        <TextField
                            label={field.title}
                            type="number"
                            fullWidth
                            value={value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            error={!!fieldError}
                            helperText={fieldError || field.helperText}
                        />
                    );
                case 'date':
                    return (
                        <TextField
                            label={field.title}
                            type="date"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            error={!!fieldError}
                            helperText={fieldError || field.helperText}
                        />
                    );
                case 'select':
                    return (
                        <FormControl fullWidth error={!!fieldError} required={field.required}>
                            <InputLabel>{field.title}</InputLabel>
                            <Select
                                label={field.title}
                                value={value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            >
                                {(field.options || []).map((opt: string) => (
                                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    );
                case 'radio':
                    return (
                        <FormControl component="fieldset">
                            <FormLabel>{field.title}</FormLabel>
                            <RadioGroup
                                row
                                value={value}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            >
                                {(field.options || []).map((opt: string) => (
                                    <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
                                ))}
                            </RadioGroup>
                        </FormControl>
                    );
                case 'checkbox':
                    if (field.options && field.options.length > 0) {
                        const checkedValues = Array.isArray(value) ? value : [];
                        return (
                            <FormControl component="fieldset">
                                <FormLabel>{field.title}</FormLabel>
                                <FormGroup row>
                                    {field.options.map((opt: string) => (
                                        <FormControlLabel
                                            key={opt}
                                            control={
                                                <Checkbox
                                                    checked={checkedValues.includes(opt)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            handleFieldChange(field.id, [...checkedValues, opt]);
                                                        } else {
                                                            handleFieldChange(field.id, checkedValues.filter((v: string) => v !== opt));
                                                        }
                                                    }}
                                                />
                                            }
                                            label={opt}
                                        />
                                    ))}
                                </FormGroup>
                            </FormControl>
                        );
                    }
                    return (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={!!value}
                                    onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                                />
                            }
                            label={field.title}
                        />
                    );
                default:
                    return (
                        <TextField
                            label={field.title}
                            fullWidth
                            value={value}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        />
                    );
            }
        })();

        return (
            <Grid key={field.id} size={{ xs: 12, md: gridWidth }}>
                {fieldElement}
            </Grid>
        );
    };

    if (isLoading) {
        return (
            <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
                <LinearProgress />
                <Typography sx={{ mt: 2, textAlign: 'center' }}>読み込み中...</Typography>
            </Box>
        );
    }

    if (!application) {
        return (
            <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
                <Alert severity="error">申請が見つかりません</Alert>
            </Box>
        );
    }

    // Check if application can be edited
    if (!['REMANDED', 'IN_PROGRESS'].includes(application.status)) {
        return (
            <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
                <Alert severity="warning">
                    この申請は編集できません。ステータス: {application.status}
                </Alert>
                <Button
                    component={Link}
                    href={`/applications/${applicationId}`}
                    sx={{ mt: 2 }}
                    startIcon={<ArrowBackIcon />}
                >
                    詳細に戻る
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            py: 4,
        }}>
            <Box sx={{ maxWidth: 900, mx: 'auto', px: 2 }}>
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
                                href="/applications"
                                variant="outlined"
                                size="small"
                            >
                                戻る
                            </Button>
                            <Chip
                                icon={<EditIcon />}
                                label="申請再編集"
                                color="warning"
                                variant="outlined"
                            />
                        </Box>
                        <Typography variant="h4" fontWeight="bold" gutterBottom>
                            {application.applicationDefinition?.name || '申請'} #{application.applicationNumber}
                        </Typography>
                        <Alert severity="info" sx={{ mt: 2 }}>
                            差し戻しされた申請です。内容を修正して再送信してください。
                        </Alert>
                    </CardContent>
                </Card>

                {/* Form Card */}
                <Card sx={{
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}>
                    <CardContent sx={{ p: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                            <EditIcon color="warning" />
                            <Typography variant="h6" fontWeight="bold">
                                申請内容を修正
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 3 }} />

                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        {sortedFields.length === 0 ? (
                            <Alert severity="info">
                                フォームフィールドがありません
                            </Alert>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                {rows.map((rowFields, rowIdx) => (
                                    <Grid container spacing={2} key={rowIdx} sx={{ mb: 2 }}>
                                        {rowFields.map(renderField)}
                                    </Grid>
                                ))}

                                <Divider sx={{ my: 3 }} />

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Button
                                        variant="outlined"
                                        component={Link}
                                        href="/applications"
                                        sx={{ borderRadius: 2 }}
                                    >
                                        キャンセル
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
                                            background: 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)',
                                            boxShadow: '0 3px 5px 2px rgba(255, 152, 0, .3)',
                                        }}
                                    >
                                        {isSubmitting ? '送信中...' : '再送信する'}
                                    </Button>
                                </Box>
                            </form>
                        )}
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
