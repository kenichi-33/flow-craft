import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Loader2, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';

interface AppDefinition {
    id: number;
    name: string;
    description?: string;
    tags?: string[];
}

export default function NewApplicationPage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Fetch published/active apps from API
    const { data: apps = [], isLoading, error } = useQuery<AppDefinition[]>({
        queryKey: ['application-definitions', 'active'],
        queryFn: () => api.get<AppDefinition[]>('/application-definitions/active'),
    });

    // Filter apps based on search and tag
    const filteredApps = useMemo(() => {
        let result = apps;
        if (searchQuery) {
            result = result.filter(app => 
                app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                app.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        if (selectedTag) {
            result = result.filter(app => app.tags?.includes(selectedTag));
        }
        return result;
    }, [apps, searchQuery, selectedTag]);

    const allTags = useMemo(() => {
        return Array.from(new Set(apps.flatMap(app => app.tags || [])));
    }, [apps]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-destructive">アプリケーション一覧の取得に失敗しました</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">新規申請</h2>
                <p className="text-muted-foreground">申請したいアプリケーションを選択してください</p>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="アプリを検索..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant={selectedTag === null ? "default" : "outline"}
                            onClick={() => setSelectedTag(null)}
                            size="sm"
                        >
                            全て
                        </Button>
                        {allTags.map(tag => (
                            <Button
                                key={tag}
                                variant={selectedTag === tag ? "default" : "outline"}
                                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                size="sm"
                            >
                                {tag}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredApps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">利用可能なアプリケーションがありません</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredApps.map(app => (
                        <Card key={app.id} className="flex flex-col hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 shadow-md overflow-hidden group">
                            <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <FileText className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                                <CardTitle className="mt-3">{app.name}</CardTitle>
                                <CardDescription className="line-clamp-2">{app.description || '説明なし'}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="flex flex-wrap gap-2">
                                    {app.tags?.map(tag => (
                                        <Badge key={tag} variant="secondary">{tag}</Badge>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter className="pt-4">
                                <Button 
                                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" 
                                    variant="outline"
                                    onClick={() => navigate(`/applications/new/${app.id}`)}
                                >
                                    申請を開始
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
