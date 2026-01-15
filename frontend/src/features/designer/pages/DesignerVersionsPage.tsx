import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RotateCcw, FileText } from 'lucide-react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { toast } from 'sonner';

interface Version {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy?: string;
    publishedByInfo?: UserSnapshot;
    formFieldCount?: number;
    flowNodeCount?: number;
}

export default function DesignerVersionsPage() {
    const { id } = useParams();
    const queryClient = useQueryClient();

    const { data: versions, isLoading, error } = useQuery<Version[]>({
        queryKey: ['app-versions', id],
        queryFn: () => api.get(`/application-definitions/${id}/versions`),
        enabled: !!id,
    });

    const { data: app } = useQuery({
        queryKey: ['application-definition', id],
        queryFn: () => api.get(`/application-definitions/${id}`),
        enabled: !!id,
    });

    const currentVersion = (app as any)?.version || 1;

    const restoreMutation = useMutation({
        mutationFn: (versionId: string) =>
            api.post(`/application-definitions/${id}/versions/${versionId}/restore`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', id] });
            toast.success('過去バージョンの設定を現在のドラフトに復元しました');
        },
    });

    if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error) return <div className="flex items-center justify-center h-64"><p className="text-destructive">データの取得に失敗しました</p></div>;

    const versionList = Array.isArray(versions) ? versions : [];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold">バージョン管理</h2>
                <p className="text-muted-foreground">公開履歴を確認し、過去バージョンをプレビュー・復元できます（現在 v{currentVersion}）</p>
            </div>

            <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle>公開履歴</CardTitle></CardHeader>
                <CardContent>
                    {versionList.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">まだ公開履歴がありません。アプリを公開するとバージョンが作成されます。</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>バージョン</TableHead>
                                    <TableHead>公開日時</TableHead>
                                    <TableHead>公開者</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {versionList.map((v) => (
                                    <TableRow key={v.id}>
                                        <TableCell>
                                            <Badge variant={v.version === currentVersion ? 'default' : 'outline'}>v{v.version}</Badge>
                                            {v.version === currentVersion && <span className="ml-2 text-xs text-muted-foreground">最新</span>}
                                        </TableCell>
                                        <TableCell>{new Date(v.publishedAt).toLocaleString('ja-JP')}</TableCell>
                                        <TableCell><UserDisplay user={v.publishedByInfo} fallback={v.publishedBy} /></TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <a href={`/designer/apps/${id}/versions/${v.id}`} target="_blank" rel="noopener noreferrer">
                                                        <FileText className="h-3 w-3 mr-1" />App Studio
                                                    </a>
                                                </Button>
                                                {v.version !== currentVersion && (
                                                    <Button variant="ghost" size="sm" onClick={() => restoreMutation.mutate(v.id)} disabled={restoreMutation.isPending}>
                                                        <RotateCcw className="h-3 w-3 mr-1" />復元
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
