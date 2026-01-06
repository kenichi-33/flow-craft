'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActionArea,
    TextField,
    InputAdornment,
    Chip,
    Autocomplete,
    Stack,
    Divider,
} from '@mui/material';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AppsIcon from '@mui/icons-material/Apps';
import SearchIcon from '@mui/icons-material/Search';
import Button from '@mui/material/Button';
import FilterListIcon from '@mui/icons-material/FilterList';

interface ApplicationDefinition {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
}

export default function SelectAppPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const { data: apps, isLoading } = useQuery<ApplicationDefinition[]>({
        queryKey: ['active-apps'],
        queryFn: () => api.get('/application-definitions/active'),
    });

    // 全タグの抽出
    const allTags = useMemo(() => {
        if (!apps) return [];
        const tags = new Set<string>();
        apps.forEach(app => {
            if (app.tags && Array.isArray(app.tags)) {
                app.tags.forEach(t => tags.add(t));
            }
        });
        return Array.from(tags).sort();
    }, [apps]);

    // 検索フィルタ
    const filteredApps = useMemo(() => {
        if (!apps) return [];
        let result = apps;

        // タグフィルタ
        if (selectedTags.length > 0) {
            result = result.filter(app => 
                app.tags && selectedTags.every(tag => app.tags?.includes(tag))
            );
        }

        // テキスト検索
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(app =>
                app.name.toLowerCase().includes(query) ||
                (app.description || '').toLowerCase().includes(query)
            );
        }
        return result;
    }, [apps, searchQuery, selectedTags]);

    return (
        <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
            <Box sx={{ mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    component={Link}
                    href="/applications"
                >
                    申請一覧に戻る
                </Button>
            </Box>

            <Typography variant="h4" gutterBottom fontWeight="bold">新規申請</Typography>
            <Typography color="text.secondary" paragraph sx={{ mb: 4 }}>
                申請したいアプリを選択してください。
            </Typography>

            <Paper sx={{ p: 2, mb: 4, bgcolor: '#f8f9fa' }} elevation={0}>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <TextField
                            fullWidth
                            placeholder="アプリ名や説明で検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ bgcolor: 'white' }}
                        />
                    </Box>
                    
                    {allTags.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FilterListIcon color="action" fontSize="small" />
                            <Autocomplete
                                multiple
                                options={allTags}
                                value={selectedTags}
                                onChange={(event, newValue) => setSelectedTags(newValue)}
                                renderTags={(value: readonly string[], getTagProps) =>
                                    value.map((option: string, index: number) => {
                                        const { key, ...tagProps } = getTagProps({ index });
                                        return (
                                            <Chip variant="outlined" label={option} size="small" key={key} {...tagProps} />
                                        );
                                    })
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="standard"
                                        placeholder={selectedTags.length === 0 ? "タグで絞り込み" : ""}
                                        sx={{ minWidth: 200 }}
                                    />
                                )}
                                sx={{ flex: 1 }}
                            />
                        </Box>
                    )}
                </Stack>
            </Paper>

            {isLoading ? (
                <Typography>読み込み中...</Typography>
            ) : filteredApps.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        {searchQuery ? '検索条件に一致するアプリがありません' : '利用可能なアプリがありません。管理者に問い合わせてください。'}
                    </Typography>
                </Paper>
            ) : (
                <Grid container spacing={2}>
                    {filteredApps.map((app) => (
                        <Grid size={4} key={app.id}>
                            <Card>
                                <CardActionArea
                                    component={Link}
                                    href={`/applications/new/${app.id}`}
                                >
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <AppsIcon color="primary" />
                                            <Typography variant="h6">{app.name}</Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            {app.description || 'クリックして申請を開始'}
                                        </Typography>
                                        {app.tags && app.tags.length > 0 && (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                                                {app.tags.map(tag => (
                                                    <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                ))}
                                            </Box>
                                        )}
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
