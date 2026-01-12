'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Grid,
    CircularProgress,
    Alert,
} from '@mui/material';
import { useParams } from 'next/navigation';
import { ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import FieldPreview from '@/components/form-designer/FieldPreview';
import PropertyPanel from '@/components/form-designer/PropertyPanel';

const useWidth = () => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(1200);

    useEffect(() => {
        if (!ref.current) return;
        
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        resizeObserver.observe(ref.current);
        setWidth(ref.current.offsetWidth);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return { ref, width };
};

interface AppVersion {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy: string | null;
    formSchema: any;
    flowNodes: any;
    flowEdges: any;
}

export default function VersionFormPage() {
    const params = useParams();
    const appId = params.id as string;
    const versionId = params.versionId as string;

    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const { ref: widthRef, width } = useWidth();

    const { data: versions, isLoading } = useQuery<AppVersion[]>({
        queryKey: ['app-versions', appId],
        queryFn: () => api.get(`/application-definitions/${appId}/versions`),
        enabled: !!appId,
    });

    const version = versions?.find(v => v.id === versionId);

    const formFields = useMemo(() => {
        if (!version?.formSchema?.properties) return [];
        const requiredFields = Array.isArray(version.formSchema.required) 
            ? version.formSchema.required 
            : [];
            
        return Object.entries(version.formSchema.properties).map(([id, config]: [string, any]) => ({
            id,
            ...config,
            required: config.required || requiredFields.includes(id)
        }));
    }, [version]);

    const selectedField = useMemo(() => {
        if (!selectedFieldId || !formFields) return null;
        return formFields.find(f => f.id === selectedFieldId) || null;
    }, [selectedFieldId, formFields]);

    const formLayouts = useMemo(() => {
        if (!version) return { lg: [] };
        const baseLayout = version.formSchema?.['x-layout'] || formFields.map((f, i) => ({ i: f.id, x: 0, y: i * 2, w: 12, h: 2 }));
        // Add static:true to prevent dragging/resizing in read-only mode
        const staticLayout = baseLayout.map((item: any) => ({ ...item, static: true }));
        return { lg: staticLayout };
    }, [version, formFields]);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!version) {
        return <Alert severity="error">バージョンが見つかりません</Alert>;
    }

    return (
        <Box sx={{ height: 'calc(100vh - 120px)' }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                フォーム定義 (v{version.version})
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
                読み取り専用モードです。フィールドをクリックすると詳細を確認できます。
            </Alert>

            <Grid container spacing={2} sx={{ height: 'calc(100% - 100px)' }}>
                <Grid size={{ xs: 12, md: 8, lg: 9 }} sx={{ height: '100%', overflow: 'auto' }}>
                    <Paper variant="outlined" sx={{ minHeight: '100%', p: 4, bgcolor: 'white', overflow: 'hidden' }} ref={widthRef}>
                        {formFields.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 8 }}>
                                <Typography color="text.secondary">
                                    このバージョンにはフォームフィールドが定義されていません
                                </Typography>
                            </Box>
                        ) : (
                            <ResponsiveGridLayout
                                className="layout"
                                layouts={formLayouts}
                                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                                cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
                                rowHeight={80}
                                width={width}
                                margin={[16, 16]}
                            >
                                {formFields.map((field) => (
                                    <div key={field.id} onClick={() => setSelectedFieldId(field.id)}>
                                        <FieldPreview
                                            field={field}
                                            isSelected={selectedFieldId === field.id}
                                            readOnly={true}
                                            onClick={() => setSelectedFieldId(field.id)}
                                        />
                                    </div>
                                ))}
                            </ResponsiveGridLayout>
                        )}
                    </Paper>
                </Grid>
                
                <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ height: '100%' }}>
                    <Paper variant="outlined" sx={{ height: '100%', bgcolor: 'white' }}>
                        <PropertyPanel 
                            field={selectedField}
                            onUpdate={() => {}}
                            existingIds={[]}
                            readOnly={true}
                        />
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
