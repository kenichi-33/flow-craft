import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { useAuthStore } from '@/stores/useAuthStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RotateCcw, FileText, PlayCircle, Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { toast } from 'sonner';

interface Version {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy?: string;
    publishedByInfo?: UserSnapshot;
    comment?: string;
    formFieldCount?: number;
    flowNodeCount?: number;
    isDraft?: boolean;
}

export default function DesignerVersionsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [selectedVersionForRestore, setSelectedVersionForRestore] = useState<number | null>(null);
    const [restoreComment, setRestoreComment] = useState('');
    // const { user } = useAuthStore(); // Unused

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
        mutationFn: (data: { version: number, comment: string }) =>
            api.post(`/application-definitions/${id}/restore/${data.version}`, { comment: data.comment }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', id] });
            queryClient.invalidateQueries({ queryKey: ['app-versions', id] });
            toast.success('過去バージョンの設定を現在のドラフトに復元しました');
            setRestoreDialogOpen(false);
            setRestoreComment('');
            setSelectedVersionForRestore(null);
        },
    });
    
    const handleTestRun = (version: number) => {
        if (confirm(`バージョン v${version} をテストモードで実行しますか？\n（申請入力画面へ移動します。外部連携はスキップされます）`)) {
             navigate(`/applications/new/${id}?version=${version}&mode=test`);
        }
    };

    const handleExport = (version: number) => {
        // Direct download link
        // Use full URL or relative to API base?
        // API base is likely /api or localhost:3000.
        // I should construct URL properly.
        // Assuming /api proxy or direct.
        // Frontend uses axios instance `api`.
        // I can just window.open the URL if I know the prefix.
        // Or fetch blob and download. Fetch blob is safer for auth headers handling if needed?
        // But backend uses Cookie/Header auth. window.open might lack headers if not cookie-based?
        // If JWT is in header, window.open fails.
        // I should use axios to get blob.
        api.get(`/application-definitions/${id}/versions/${version}/export`, { responseType: 'blob' })
           .then((blob: any) => {
               const url = window.URL.createObjectURL(blob);
               const link = document.createElement('a');
               link.href = url;
               // Filename content-disposition?
               // Axios might not parse filename easily from header.
               // Just generate one.
               link.setAttribute('download', `app_${id}_v${version}.json`);
               document.body.appendChild(link);
               link.click();
               link.remove();
               window.URL.revokeObjectURL(url);
           })
           .catch((err) => {
               console.error(err);
               toast.error('エクスポートに失敗しました');
           });
    };

    const importMutation = useMutation({
        mutationFn: (data: any) => api.post(`/application-definitions/${id}/import-version`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app-versions', id] });
            queryClient.invalidateQueries({ queryKey: ['app-versions', id] });
            toast.success('下書きとしてインポートしました。内容を確認して公開してください。');
        },
        onError: () => toast.error('インポートに失敗しました'),
    });

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (confirm(`ファイル "${file.name}" を新しいバージョンとしてインポートしますか？`)) {
                    importMutation.mutate(json);
                }
            } catch (err) {
                toast.error('無効なJSONファイルです');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleRestoreClick = (version: number) => {
        setSelectedVersionForRestore(version);
        setRestoreComment(`v${version} からの復元`);
        setRestoreDialogOpen(true);
    };

    const handleRestoreConfirm = () => {
        if (selectedVersionForRestore !== null) {
            restoreMutation.mutate({ version: selectedVersionForRestore, comment: restoreComment });
        }
    };

    if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error) return <div className="flex items-center justify-center h-64"><p className="text-destructive">データの取得に失敗しました</p></div>;

    const versionList = Array.isArray(versions) ? [...versions] : [];
    
    // Draft Information (Current AppDef)
    const draftVersion: any = app ? {
        id: 'draft',
        version: versionList.length > 0 ? Math.max(...versionList.map(v => v.version)) + 1 : 1,
        isDraft: true,
        publishedAt: (app as any).updatedAt,
        publishedBy: (app as any).updatedBy,
        publishedByInfo: (app as any).updatedByInfo,
        comment: '現在の下書き',
        formUpdatedAt: (app as any).formDefinition?.updatedAt,
        flowUpdatedAt: (app as any).flowDefinition?.updatedAt,
    } : null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold">バージョン管理</h2>
                <p className="text-muted-foreground">公開履歴を確認し、過去バージョンをプレビュー・復元できます（現在 v{currentVersion}）</p>
            </div>

            {/* Draft Section */}
            {draftVersion && (
                <Card className="border-l-4 border-l-yellow-500 shadow-sm bg-muted/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-yellow-600" />
                                現在の下書き
                                <Badge variant="secondary" className="ml-2">Next: v{draftVersion.version}</Badge>
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button variant="default" size="sm" onClick={() => {
                                    if (confirm('現在の下書きをテストモードで実行しますか？')) {
                                        navigate(`/applications/new/${id}?mode=test&draft=true`);
                                    }
                                }}>
                                    <PlayCircle className="h-4 w-4 mr-2" />
                                    下書きをテスト
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2">
                                    <span>アプリ更新:</span>
                                    <span className="text-foreground">{new Date(draftVersion.publishedAt).toLocaleString('ja-JP')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>更新者:</span>
                                    <UserDisplay user={draftVersion.publishedByInfo} fallback={draftVersion.publishedBy} />
                                </div>
                            </div>
                            <div className="flex gap-6 mt-1 pt-2 border-t border-muted-foreground/20">
                                <div className="flex items-center gap-2" title="フォーム定義の最終更新">
                                    <span className="text-xs uppercase tracking-wider">Form:</span>
                                    <span className="text-foreground">{draftVersion.formUpdatedAt ? new Date(draftVersion.formUpdatedAt).toLocaleString('ja-JP') : '-'}</span>
                                </div>
                                <div className="flex items-center gap-2" title="フロー定義の最終更新">
                                    <span className="text-xs uppercase tracking-wider">Flow:</span>
                                    <span className="text-foreground">{draftVersion.flowUpdatedAt ? new Date(draftVersion.flowUpdatedAt).toLocaleString('ja-JP') : '-'}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>バージョン一覧</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <label className="cursor-pointer">
                                <Upload className="h-4 w-4 mr-2" />
                                インポート
                                <input type="file" className="hidden" accept=".json" onChange={handleImportFile} disabled={importMutation.isPending} />
                            </label>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {versionList.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">データがありません。</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>バージョン</TableHead>
                                    <TableHead>更新/公開日時</TableHead>
                                    <TableHead>更新/公開者</TableHead>
                                    <TableHead>コメント</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {versionList.map((v) => (
                                    <TableRow key={v.id}>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <Badge variant={v.version === currentVersion ? 'default' : 'outline'}>v{v.version}</Badge>
                                                {v.version === currentVersion && <span className="ml-2 text-xs text-muted-foreground">最新</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>{new Date(v.publishedAt).toLocaleString('ja-JP')}</TableCell>
                                        <TableCell><UserDisplay user={v.publishedByInfo} fallback={v.publishedBy} /></TableCell>
                                        <TableCell className="max-w-xs truncate text-muted-foreground" title={v.comment || ''}>
                                            {v.comment || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <a href={`/designer/apps/${id}/versions/${v.id}`} target="_blank" rel="noopener noreferrer">
                                                        <FileText className="h-3 w-3 mr-1" />詳細
                                                    </a>
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleTestRun(v.version)}>
                                                    <PlayCircle className="h-3 w-3 mr-1" />
                                                    テスト
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleExport(v.version)}>
                                                    <Download className="h-3 w-3 mr-1" />
                                                    DL
                                                </Button>
                                                {v.version !== currentVersion && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestoreClick(v.version)} disabled={restoreMutation.isPending}>
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

            <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>バージョン復元</DialogTitle>
                        <DialogDescription>
                            バージョン v{selectedVersionForRestore} を最新バージョンとして復元します。
                            現在の下書き内容は上書きされます。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="restore-comment">コメント（任意）</Label>
                        <Textarea
                            id="restore-comment"
                            placeholder="復元の理由などを入力"
                            value={restoreComment}
                            onChange={(e) => setRestoreComment(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>キャンセル</Button>
                        <Button onClick={handleRestoreConfirm} disabled={restoreMutation.isPending}>
                            {restoreMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            復元して公開
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
