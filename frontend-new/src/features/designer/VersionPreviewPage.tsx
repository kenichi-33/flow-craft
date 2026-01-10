// VersionPreviewPage - View a specific published version of an app definition
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileText, GitFork } from 'lucide-react';

interface AppVersion {
    id: string;
    version: number;
    publishedAt: string;
    publishedBy: string | null;
    formSchema: any;
    flowNodes: any[];
    flowEdges: any[];
}

export default function VersionPreviewPage() {
    const { id: appId, versionId } = useParams();
    const navigate = useNavigate();

    const { data: app, isLoading: appLoading } = useQuery({
        queryKey: ['apps', appId],
        queryFn: () => api.get(`/application-definitions/${appId}`),
        enabled: !!appId,
    });

    const { data: versions, isLoading: versionsLoading } = useQuery<AppVersion[]>({
        queryKey: ['app-versions', appId],
        queryFn: () => api.get(`/application-definitions/${appId}/versions`),
        enabled: !!appId,
    });

    const version = versions?.find(v => v.id === versionId);

    if (appLoading || versionsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!version) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-destructive">バージョンが見つかりません</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />戻る
                </Button>
            </div>
        );
    }

    const formFieldCount = version.formSchema?.properties ? Object.keys(version.formSchema.properties).length : 0;
    const flowNodeCount = Array.isArray(version.flowNodes) ? version.flowNodes.length : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        バージョン {version.version} のプレビュー
                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">読み取り専用</span>
                    </h1>
                    <p className="text-muted-foreground">{(app as any)?.name || (app as any)?.appName}</p>
                </div>
            </div>

            {/* Aligned Layout with DesignerOverviewPage */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Basic Info (Read Only) */}
                <Card className="md:col-span-2 border-0 shadow-sm">
                    <CardHeader><CardTitle>基本情報</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">アプリ名</span>
                            <div className="p-2 border rounded-md bg-muted/50 text-sm">{(app as any)?.name || (app as any)?.appName || '名称未設定'}</div>
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">説明</span>
                            <div className="p-2 border rounded-md bg-muted/50 text-sm min-h-[80px]">{(app as any)?.description || '説明なし'}</div>
                        </div>
                        <div className="space-y-2">
                            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">バージョン情報</span>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-2 border rounded-md bg-muted/50 text-sm">
                                    <span className="text-muted-foreground block text-xs mb-1">バージョン</span>
                                    v{version.version}
                                </div>
                                <div className="p-2 border rounded-md bg-muted/50 text-sm">
                                    <span className="text-muted-foreground block text-xs mb-1">公開日時</span>
                                    {new Date(version.publishedAt).toLocaleString('ja-JP')}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                <div className="space-y-4">
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-primary">
                                <FileText className="h-5 w-5" />
                                <CardTitle className="text-base">フォーム</CardTitle>
                            </div>
                            <div className="text-sm text-muted-foreground">フィールド数: {formFieldCount}</div>
                        </CardHeader>
                        <CardContent>
                             <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`form`)}>
                                確認する
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2 text-primary">
                                <GitFork className="h-5 w-5" />
                                <CardTitle className="text-base">フロー</CardTitle>
                            </div>
                             <div className="text-sm text-muted-foreground">ノード数: {flowNodeCount}</div>
                        </CardHeader>
                        <CardContent>
                             <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`flow`)}>
                                確認する
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
