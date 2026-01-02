'use client';

import React, { useMemo } from 'react';
import {
    Box,
    Typography,
    Grid,
    TextField,
    Divider,
    Paper,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';

interface FormSchema {
    properties?: Record<string, FieldDef>;
    'x-layout'?: LayoutItem[];
}

interface FieldDef {
    type: string;
    title: string;
    options?: string[];
}

interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface ApplicationFormViewerProps {
    schema?: FormSchema;
    inputData?: Record<string, any>;
    title?: string;
}

/**
 * 申請内容を読み取り専用で表示する共通コンポーネント
 * 承認画面、申請詳細画面、進捗画面で利用
 */
export default function ApplicationFormViewer({
    schema,
    inputData = {},
    title = '申請内容'
}: ApplicationFormViewerProps) {
    const properties = schema?.properties || {};
    const layout = schema?.['x-layout'] || [];

    // レイアウト順でフィールドをソート
    const sortedFields = useMemo(() => {
        const fields = Object.entries(properties)
            .map(([id, prop]) => {
                const layoutItem = layout.find((l) => l.i === id);
                return {
                    id,
                    ...prop,
                    x: layoutItem?.x ?? 0,
                    y: layoutItem?.y ?? 0,
                    w: layoutItem?.w ?? 12,
                };
            });
        fields.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
        return fields;
    }, [properties, layout]);

    // 行でグループ化
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

    // フィールドの読み取り専用表示
    const renderField = (field: any) => {
        const value = inputData[field.id] ?? '';
        const gridWidth = Math.min(12, Math.max(1, field.w));

        if (field.type === 'divider') {
            return <Grid key={field.id} size={12}><Divider sx={{ my: 1 }} /></Grid>;
        }
        if (field.type === 'label') {
            return (
                <Grid key={field.id} size={12}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 1 }}>
                        {field.title}
                    </Typography>
                </Grid>
            );
        }

        let displayValue = value;
        if (Array.isArray(value)) displayValue = value.join(', ');
        if (typeof value === 'boolean') displayValue = value ? 'はい' : 'いいえ';
        if (value === '' || value === null || value === undefined) displayValue = '-';

        return (
            <Grid key={field.id} size={{ xs: 12, md: gridWidth }}>
                <TextField
                    label={field.title}
                    value={displayValue}
                    fullWidth
                    size="small"
                    slotProps={{ input: { readOnly: true } }}
                    sx={{ '& .MuiInputBase-input': { bgcolor: '#f5f5f5' } }}
                />
            </Grid>
        );
    };

    if (sortedFields.length === 0) {
        return (
            <Paper sx={{ p: 2 }}>
                <Typography color="text.secondary">申請内容がありません</Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="h6">{title}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {rows.map((rowFields, rowIdx) => (
                <Grid container spacing={2} key={rowIdx} sx={{ mb: 1 }}>
                    {rowFields.map(renderField)}
                </Grid>
            ))}
        </Paper>
    );
}
