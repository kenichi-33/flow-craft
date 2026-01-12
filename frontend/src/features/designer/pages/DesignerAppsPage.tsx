import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, FileEdit, History, ArrowUpDown } from 'lucide-react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';

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
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const { data: response, isLoading, error } = useQuery<AppDefinitionsResponse>({
        queryKey: ['application-definitions', globalFilter, sorting, pagination],
        queryFn: () => {
            const params = new URLSearchParams();
            if (globalFilter) params.append('search', globalFilter);
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

    const columns: ColumnDef<AppDefinition>[] = useMemo(() => [
        {
            id: 'name',
            header: 'アプリ名',
            cell: ({ row }) => (
                <div>
                    <Link to={`/designer/apps/${row.original.id}`} className="text-primary font-bold hover:underline">
                        {row.original.name}
                    </Link>
                    {row.original.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.original.description}</p>
                    )}
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
            id: 'formDefinition',
            header: 'フォーム',
            cell: ({ row }) => row.original.formDefinition ? (
                <Badge variant="outline">{row.original.formDefinition.name}</Badge>
            ) : (
                <Badge variant="destructive" className="text-xs">未設定</Badge>
            ),
        },
        {
            id: 'flowDefinition',
            header: 'フロー',
            cell: ({ row }) => row.original.flowDefinition ? (
                <Badge variant="outline">{row.original.flowDefinition.name}</Badge>
            ) : (
                <Badge variant="destructive" className="text-xs">未設定</Badge>
            ),
        },
        {
            accessorKey: 'createdAt',
            header: '作成日時',
            cell: ({ row }) => (
                <div>
                    <span className="text-sm">{new Date(row.original.createdAt).toLocaleString('ja-JP')}</span>
                    {row.original.createdByInfo && (
                        <div className="mt-0.5"><UserDisplay user={row.original.createdByInfo} fallback={row.original.createdBy} /></div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'updatedAt',
            header: '更新日時',
            cell: ({ row }) => (
                <div>
                    <span className="text-sm">{new Date(row.original.updatedAt).toLocaleString('ja-JP')}</span>
                    {row.original.updatedByInfo && (
                        <div className="mt-0.5"><UserDisplay user={row.original.updatedByInfo} fallback={row.original.updatedBy} /></div>
                    )}
                </div>
            ),
        },
        {
            id: 'actions',
            header: '操作',
            cell: ({ row }) => (
                <div className="flex gap-1">
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
            <div className="flex items-center py-4"><Input placeholder="アプリ名、説明で検索..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm" /></div>
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                {isLoading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                    <Table>
                        <TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id} className="whitespace-nowrap">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/designer/apps/${row.original.id}`)}>
                                    {row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">アプリがありません。「新規アプリ作成」から作成してください。</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                )}
            </div>
            <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">{response?.pagination?.total || 0} 件中 {apps.length} 件を表示</p>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>前へ</Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
