import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Loader2, FileText, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

    // Fetch published/active apps
    const { data: apps = [], isLoading, error } = useQuery<AppDefinition[]>({
        queryKey: ['application-definitions', 'active'],
        queryFn: () => api.get<AppDefinition[]>('/application-definitions/active'),
    });

    // Extract all unique tags
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        apps.forEach(app => app.tags?.forEach(tag => tags.add(tag)));
        return Array.from(tags).sort();
    }, [apps]);

    // Filter logic
    const filteredApps = useMemo(() => {
        let result = apps;
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(app => 
                app.name.toLowerCase().includes(lowerQuery) || 
                app.description?.toLowerCase().includes(lowerQuery)
            );
        }
        if (selectedTag) {
            result = result.filter(app => app.tags?.includes(selectedTag));
        }
        return result;
    }, [apps, searchQuery, selectedTag]);

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                    <div className="bg-destructive/10 p-4 rounded-full inline-block">
                        <FileText className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-destructive font-medium">アプリケーション一覧の取得に失敗しました</p>
                    <Button variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background/50 -m-8 p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                
                {/* Hero Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/90 via-primary/80 to-indigo-600 text-primary-foreground shadow-xl"
                >
                    <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                    <div className="relative z-10 p-6 md:p-8 text-center space-y-4">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium border border-white/20"
                        >
                            <Sparkles className="h-3 w-3 text-yellow-300" />
                            <span>FlowCraft Portal</span>
                        </motion.div>
                        
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                            新しい申請をはじめる
                        </h1>
                        <p className="text-sm md:text-base text-primary-foreground/90 max-w-xl mx-auto font-light leading-relaxed">
                            必要なアプリケーションを選択して、ワークフローを開始しましょう。
                        </p>

                        <div className="max-w-lg mx-auto pt-2 relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80" />
                                <Input
                                    type="text"
                                    placeholder="アプリ名やキーワードで検索..."
                                    className="pl-9 h-10 rounded-xl text-base bg-background/95 text-foreground shadow-md border-0 ring-offset-2 focus-visible:ring-offset-primary/50"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Filter & Grid Section */}
                <div className="space-y-6">
                    {/* Tags */}
                    {allTags.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-wrap items-center justify-center gap-2"
                        >
                            <Button 
                                variant={selectedTag === null ? "secondary" : "ghost"}
                                onClick={() => setSelectedTag(null)}
                                className={`rounded-full px-6 transition-all ${selectedTag === null ? 'shadow-md font-bold' : ''}`}
                            >
                                すべて
                            </Button>
                            {allTags.map((tag) => (
                                <Button
                                    key={tag}
                                    variant={selectedTag === tag ? "secondary" : "ghost"}
                                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                                    className={`rounded-full px-5 transition-all ${selectedTag === tag ? 'shadow-md font-bold ring-2 ring-primary/20' : ''}`}
                                >
                                    {tag}
                                </Button>
                            ))}
                        </motion.div>
                    )}

                    {/* App Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        <motion.div 
                            layout
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence mode='popLayout'>
                                {filteredApps.length === 0 ? (
                                    <motion.div 
                                        initial={{ opacity: 0 }} 
                                        animate={{ opacity: 1 }} 
                                        className="col-span-full text-center py-20 text-muted-foreground"
                                    >
                                        <Layers className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p className="text-lg">条件に一致するアプリが見つかりませんでした</p>
                                        <Button variant="link" onClick={() => { setSearchQuery(''); setSelectedTag(null); }}>
                                            条件をクリア
                                        </Button>
                                    </motion.div>
                                ) : (
                                    filteredApps.map((app, index) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2, delay: index * 0.05 }}
                                            key={app.id}
                                        >
                                            <Card className="h-full hover:shadow-xl transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm group hover:-translate-y-1">
                                                <CardHeader>
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="bg-primary/10 p-3 rounded-xl group-hover:bg-primary/20 transition-colors">
                                                            <FileText className="h-6 w-6 text-primary" />
                                                        </div>
                                                        {app.tags && app.tags.length > 0 && (
                                                            <div className="flex flex-wrap justify-end gap-1">
                                                                {app.tags.slice(0, 2).map(tag => (
                                                                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                                {app.tags.length > 2 && (
                                                                    <Badge variant="outline" className="text-xs">+{app.tags.length - 2}</Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <CardTitle className="pt-4 text-xl group-hover:text-primary transition-colors">
                                                        {app.name}
                                                    </CardTitle>
                                                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                                                        {app.description || '説明なし'}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardFooter className="pt-2">
                                                    <Button 
                                                        className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all" 
                                                        onClick={() => navigate(`/applications/new/${app.id}`)}
                                                    >
                                                        作成する <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
