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
import { Loader2, FileEdit, GitBranch, Save, Search, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

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
    adminIds?: string[];
    adminInfo?: any[];
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

    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    const [adminIds, setAdminIds] = useState<string[]>([]);
    const [displayAdmins, setDisplayAdmins] = useState<any[]>([]); // To show names immediately
    const [adminDialogOpen, setAdminDialogOpen] = useState(false);
    const [adminSearchQuery, setAdminSearchQuery] = useState('');

    // User Search Query
    const { data: userSearchResults } = useQuery<any[]>({ 
        queryKey: ['user-search', adminSearchQuery], 
        queryFn: () => api.get(`/users/search?q=${encodeURIComponent(adminSearchQuery)}&limit=10`).then((r: any) => {
            const list = r.data || (Array.isArray(r) ? r : []);
            return list.filter((u: any) => u.roles?.includes('wf_app_admin') || u.roles?.includes('wf_admin'));
        }), 
        enabled: adminDialogOpen && adminSearchQuery.length > 0 
    });

    // Initialize form when data loads
    useEffect(() => {
        if (app && !initialized) {
            setName(app.name || app.appName || '');
            setDescription(app.description || '');
            setStatus(app.status);
            setTags(app.tags || []);
            setAdminIds(app.adminIds || []);
            setDisplayAdmins(app.adminInfo || []);
            setInitialized(true);
        }
    }, [app, initialized]);

    const updateMutation = useMutation({
        mutationFn: (data: { name: string; description?: string; status: string; tags: string[]; adminIds?: string[] }) =>
            api.put(`/application-definitions/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', id] });
            toast.success("保存しました", {
                description: "設定が正常に更新されました。",
            });
        },
        onError: () => {
            toast.error("保存失敗", {
                description: "設定の更新に失敗しました。",
            });
        }
    });

    const addTag = (e?: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setNewTag('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const addAdmin = (user: any) => {
        // Use username for stability across realm recreations
        if (user.username && !adminIds.includes(user.username)) {
            setAdminIds([...adminIds, user.username]);
            setDisplayAdmins([...displayAdmins, { ...user, type: 'user' }]); // Add to display list
            setAdminDialogOpen(false);
            setAdminSearchQuery('');
        }
    };

    const removeAdmin = (adminId: string) => {
        setAdminIds(adminIds.filter(id => id !== adminId));
        // Filter out from display list. adminId passed here is expected to be the stored ID (username or UUID)
        setDisplayAdmins(displayAdmins.filter(a => (a.username !== adminId && a.id !== adminId)));
    };

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
                            <Label>タグ</Label>
                            <div className="flex gap-2">
                                <Input 
                                    value={newTag} 
                                    onChange={(e) => setNewTag(e.target.value)} 
                                    placeholder="新しいタグを追加..." 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addTag();
                                        }
                                    }}
                                />
                                <Button variant="secondary" onClick={addTag} type="button">追加</Button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                                        {tag}
                                        <button 
                                            onClick={() => removeTag(tag)} 
                                            className="hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                                        >
                                            <span className="sr-only">削除</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                        </button>
                                    </Badge>
                                ))}
                                {tags.length === 0 && <span className="text-sm text-muted-foreground">タグは設定されていません</span>}
                            </div>
                        </div>
                        
                        {/* App Admins */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>アプリ管理者</Label>
                                <Button variant="outline" size="sm" onClick={() => setAdminDialogOpen(true)}>
                                    <Plus className="h-3 w-3 mr-1" /> 追加
                                </Button>
                            </div>
                            <div className="space-y-2 border rounded-md p-2 min-h-[4rem]">
                                {displayAdmins.map(admin => (
                                    <div key={admin.username} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {(admin.firstName?.[0] || admin.username[0]).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="font-medium">{admin.lastName || ''} {admin.firstName || ''}</span>
                                                <span className="text-xs text-muted-foreground ml-1">@{admin.username}</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeAdmin(admin.username || admin.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                {displayAdmins.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">管理者が指定されていません（作成者のみ編集可能）</p>}
                            </div>
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
                            <Button onClick={() => updateMutation.mutate({ name, description, status, tags, adminIds })} disabled={updateMutation.isPending}>
                                <Save className="h-4 w-4 mr-2" />設定を保存
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

            {/* Admin Add Dialog */}
            <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>管理者追加</DialogTitle>
                        <DialogDescription>ユーザーを検索して管理者に追加します</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ユーザー検索</Label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="名前またはID..." className="pl-8" value={adminSearchQuery} onChange={(e) => setAdminSearchQuery(e.target.value)} />
                            </div>
                            {userSearchResults && (
                                <div className="border rounded-md max-h-48 overflow-auto mt-2">
                                    {userSearchResults.map((u: any) => (
                                        <div key={u.id} 
                                            className="p-2 cursor-pointer hover:bg-muted flex justify-between items-center" 
                                            onClick={() => addAdmin(u)}
                                        >
                                            <div>
                                                <span>{u.displayName || u.username}</span>
                                                <span className="text-xs text-muted-foreground ml-2">@{u.username}</span>
                                            </div>
                                            {(adminIds.includes(u.username) || adminIds.includes(u.id)) && <Badge variant="outline">追加済み</Badge>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
