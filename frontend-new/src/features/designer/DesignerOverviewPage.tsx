import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useParams } from 'react-router-dom';
import { Loader2, FileEdit, GitBranch, Save } from 'lucide-react';

interface AppDefinition {
    id: number;
    name: string;
    appName?: string;
    description?: string;
    tags?: string[];
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    version: number;
    formDefinition?: { schema?: { properties?: object } };
    flowDefinition?: { nodes?: any[] };
    createdAt: string;
    updatedAt: string;
}

export default function DesignerOverviewPage() {
    const { id } = useParams();
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT');
    const [initialized, setInitialized] = useState(false);

    const { data: app, isLoading, error } = useQuery<AppDefinition>({
        queryKey: ['application-definition', id],
        queryFn: () => api.get<AppDefinition>(`/application-definitions/${id}`),
        enabled: !!id,
    });

    // Initialize form when data loads
    useEffect(() => {
        if (app && !initialized) {
            setName(app.name || app.appName || '');
            setDescription(app.description || '');
            setStatus(app.status);
            setInitialized(true);
        }
    }, [app, initialized]);

    const updateMutation = useMutation({
        mutationFn: (data: { name: string; description?: string; status: string }) =>
            api.put(`/application-definitions/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', id] });
        },
    });

    if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error || !app) return <div className="flex items-center justify-center h-64"><p className="text-destructive">アプリ情報の取得に失敗しました</p></div>;

    const formFieldCount = app.formDefinition?.schema?.properties ? Object.keys(app.formDefinition.schema.properties).length : 0;
    const flowNodeCount = app.flowDefinition?.nodes?.length || 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">概観設定 (Overview)</h2>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Basic Info */}
                <Card className="md:col-span-2 border-0 shadow-sm">
                    <CardHeader><CardTitle>基本情報</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>アプリ名</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>説明</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                        </div>
                        <div className="space-y-2">
                            <Label>ステータス</Label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full p-2 border rounded-md">
                                <option value="DRAFT">下書き (Draft)</option>
                                <option value="ACTIVE">公開中 (Active)</option>
                                <option value="ARCHIVED">アーカイブ (Archived)</option>
                            </select>
                            <p className="text-xs text-muted-foreground">「アーカイブ」にするとメニューから隠れます</p>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={() => updateMutation.mutate({ name, description, status })} disabled={updateMutation.isPending}>
                                <Save className="h-4 w-4 mr-2" />基本情報を保存
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                <div className="space-y-4">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-primary">
                                <FileEdit className="h-5 w-5" />
                                <CardTitle className="text-base">フォーム</CardTitle>
                            </div>
                            <CardDescription>フィールド数: {formFieldCount}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <a href={`/designer/apps/${id}/form`}>編集する</a>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-primary">
                                <GitBranch className="h-5 w-5" />
                                <CardTitle className="text-base">フロー</CardTitle>
                            </div>
                            <CardDescription>ノード数: {flowNodeCount}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <a href={`/designer/apps/${id}/flow`}>編集する</a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Warnings */}
            {(formFieldCount === 0 || flowNodeCount === 0) && (
                <Alert>
                    <AlertDescription>
                        {formFieldCount === 0 && '⚠️ フォームが設定されていません。'}
                        {flowNodeCount === 0 && ' ⚠️ フローが設定されていません。'}
                        公開するには両方の設定が必要です。
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
