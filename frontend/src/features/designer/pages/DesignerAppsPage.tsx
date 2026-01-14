import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plus, FileEdit, History, LayoutGrid, List as ListIcon, Tag, X } from 'lucide-react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { Separator } from '@/components/ui/separator';

interface AppDefinition {
    id: number;
    name: string;
    appName?: string;
    description?: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    version: number;
    publishedAt: string | null;
    formDefinition: { id: string; name: string } | null;
    flowDefinition: { id: string; name: string } | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;
    createdByInfo?: UserSnapshot;
    updatedByInfo?: UserSnapshot;
}

interface AppDefinitionsResponse { data: AppDefinition[]; pagination: { total: number; page: number; limit: number; totalPages: number; }; }

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    DRAFT: { label: '下書き', variant: 'outline' },
    ACTIVE: { label: '公開中', variant: 'default' },
    ARCHIVED: { label: 'アーカイブ', variant: 'secondary' },
};

export default function DesignerAppsPage() {
    const navigate = useNavigate();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [tagsFilter, setTagsFilter] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 12 }); // Grid view works better with 12
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const { data: response, isLoading, error } = useQuery<AppDefinitionsResponse>({
        queryKey: ['application-definitions', globalFilter, tagsFilter, sorting, pagination],
        queryFn: () => {
            const params = new URLSearchParams();
            if (globalFilter) params.append('search', globalFilter);
            if (tagsFilter.length > 0) params.append('tags', tagsFilter.join(','));
            
            params.append('limit', pagination.pageSize.toString());
            params.append('page', (pagination.pageIndex + 1).toString());
            if (sorting.length > 0) {
                params.append('sortBy', sorting[0].id);
                params.append('sortOrder', sorting[0].desc ? 'desc' : 'asc');
            }
            return api.get<AppDefinitionsResponse>(`/application-definitions?${params.toString()}`);
        },
    });

    const apps = useMemo(() => response?.data || [], [response]);

    const handleAddTag = () => {
        if (tagInput && !tagsFilter.includes(tagInput)) {
            setTagsFilter([...tagsFilter, tagInput]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setTagsFilter(tagsFilter.filter(t => t !== tag));
    };

    const columns: ColumnDef<AppDefinition>[] = useMemo(() => [
        {
            id: 'name',
            header: 'アプリ名',
            cell: ({ row }) => (
                <div>
                    <Link to={`/designer/apps/${row.original.id}`} className="text-primary font-bold hover:underline block">
                        {row.original.name}
                    </Link>
                    {row.original.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.original.description}</p>
                    )}
                    <div className="flex gap-1 mt-1 flex-wrap">
                        {row.original.tags && row.original.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">{tag}</Badge>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'version',
            header: 'バージョン',
            cell: ({ row }) => (
                <div>
                    <Badge variant="outline" className="font-semibold">v{row.original.version}</Badge>
                    {row.original.publishedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(row.original.publishedAt).toLocaleDateString('ja-JP')}
                        </p>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'status',
            header: 'ステータス',
            cell: ({ row }) => {
                const s = row.original.status;
                const c = statusConfig[s] || { label: s, variant: 'outline' as const };
                return <Badge variant={c.variant}>{c.label}</Badge>;
            },
        },
        {
            id: 'definitions',
            header: '構成',
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-1">
                        <span className="text-muted-foreground w-10">フォーム:</span>
                        {row.original.formDefinition ? (
                            <Badge variant="outline" className="font-normal">{row.original.formDefinition.name}</Badge>
                        ) : <span className="text-destructive">未設定</span>}
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-muted-foreground w-10">フロー:</span>
                        {row.original.flowDefinition ? (
                            <Badge variant="outline" className="font-normal">{row.original.flowDefinition.name}</Badge>
                        ) : <span className="text-destructive">未設定</span>}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'updatedAt',
            header: '更新情報',
            cell: ({ row }) => (
                <div>
                    <div className="text-sm">{new Date(row.original.updatedAt).toLocaleString('ja-JP')}</div>
                    {row.original.updatedByInfo && (
                        <div className="mt-0.5 text-xs"><UserDisplay user={row.original.updatedByInfo} fallback={row.original.updatedBy} /></div>
                    )}
                </div>
            ),
        },
        {
            id: 'actions',
            header: '操作',
            cell: ({ row }) => (
                <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/designer/apps/${row.original.id}`); }}>
                        <FileEdit className="h-3 w-3 mr-1" />編集
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/designer/apps/${row.original.id}/versions`); }}>
                        <History className="h-3 w-3" />
                    </Button>
                </div>
            ),
        },
    ], [navigate]);

    const table = useReactTable({ 
        data: apps, 
        columns, 
        getCoreRowModel: getCoreRowModel(), 
        manualPagination: true,
        manualSorting: true,
        pageCount: response?.pagination?.totalPages ?? -1,
        onPaginationChange: setPagination,
        onSortingChange: setSorting, 
        state: { sorting, pagination } 
    });

    if (error) return <div className="flex items-center justify-center h-64"><p className="text-destructive">データの取得に失敗しました</p></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h2 className="text-3xl font-bold tracking-tight">アプリ管理</h2><p className="text-muted-foreground">ワークフローアプリの作成・管理</p></div>
                <Button asChild><Link to="/designer/apps/new"><Plus className="h-4 w-4 mr-2" />新規アプリ作成</Link></Button>
            </div>
            
            <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <Input 
                            placeholder="アプリ名、説明で検索..." 
                            value={globalFilter ?? ''} 
                            onChange={(e) => setGlobalFilter(e.target.value)} 
                            className="w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Input 
                            placeholder="タグでフィルタ..." 
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                            className="w-[150px]"
                        />
                        <Button variant="ghost" size="icon" onClick={handleAddTag} disabled={!tagInput}><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 border rounded-md p-1 bg-muted/20">
                    <Button 
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('list')}
                        className="h-8 w-8 p-0"
                    >
                        <ListIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => { setViewMode('grid'); setPagination(p => ({ ...p, pageSize: 12 })); }}
                        className="h-8 w-8 p-0"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {tagsFilter.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground"><Tag className="h-3 w-3 inline mr-1" />フィルタ:</span>
                    {tagsFilter.map(tag => (
                        <Badge key={tag} variant="secondary" className="pl-2 pr-1 gap-1">
                            {tag}
                            <Button variant="ghost" size="icon" className="h-3 w-3 hover:bg-transparent" onClick={() => handleRemoveTag(tag)}>
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setTagsFilter([])}>クリア</Button>
                </div>
            )}

            <div className="min-h-[400px]">
                {isLoading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                    <>
                        {viewMode === 'list' ? (
                            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                                <Table>
                                    <TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id} className="whitespace-nowrap">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                            <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/designer/apps/${row.original.id}`)}>
                                                {row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">アプリがありません</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {apps.length > 0 ? apps.map((app) => (
                                    <Card key={app.id} className="cursor-pointer hover:shadow-md transition-shadow flex flex-col group" onClick={() => navigate(`/designer/apps/${app.id}`)}>
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">{app.name}</CardTitle>
                                                    <CardDescription className="line-clamp-2 text-xs h-8">{app.description}</CardDescription>
                                                </div>
                                                <Badge variant={statusConfig[app.status]?.variant || 'outline'}>{statusConfig[app.status]?.label}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-4 py-2 flex-1">
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {app.tags && app.tags.map(tag => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1">{tag}</Badge>
                                                ))}
                                            </div>
                                            <div className="text-xs space-y-1 text-muted-foreground">
                                                <div className="flex justify-between">
                                                    <span>バージョン:</span>
                                                    <span className="font-semibold text-foreground">v{app.version}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>更新:</span>
                                                    <span>{new Date(app.updatedAt).toLocaleDateString('ja-JP')}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <Separator />
                                        <CardFooter className="p-2 bg-muted/10 flex justify-between gap-1">
                                            <div className="flex items-center gap-2">
                                                 {app.updatedByInfo && <UserDisplay user={app.updatedByInfo} fallback={app.updatedBy} />}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigate(`/designer/apps/${app.id}`); }}>
                                                    <FileEdit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigate(`/designer/apps/${app.id}/versions`); }}>
                                                    <History className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                )) : (
                                    <div className="col-span-full h-48 flex items-center justify-center border rounded-lg border-dashed text-muted-foreground">
                                        アプリがありません
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">{response?.pagination?.total || 0} 件中 {apps.length} 件を表示</p>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex - 1 }))} disabled={pagination.pageIndex === 0}>前へ</Button>
                    <Button variant="outline" size="sm" onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex + 1 }))} disabled={!response || (pagination.pageIndex + 1) >= response.pagination.totalPages}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
