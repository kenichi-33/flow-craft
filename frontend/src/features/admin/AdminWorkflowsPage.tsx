import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, ArrowUpDown } from 'lucide-react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { TruncatedCell } from '@/components/common/TruncatedCell';

interface Application {
    id: string;
    applicationNumber: number;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    applicantId: string;
    applicantInfo?: UserSnapshot;
    currentNodeId?: string;
    applicationDefinition?: { id: number; name?: string; appName?: string };
    flowDefinition?: { nodes: any[] };
    flowNodes?: any[];
}

interface ApplicationsResponse { 
    data: Application[]; 
    pagination: { 
        total: number; 
        page: number; 
        limit: number; 
        totalPages: number; 
    }; 
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    DRAFT: { label: '下書き', variant: 'outline' },
    IN_PROGRESS: { label: '処理中', variant: 'secondary' },
    APPROVED: { label: '承認済', variant: 'default' },
    REJECTED: { label: '却下', variant: 'destructive' },
    REMANDED: { label: '差戻し', variant: 'destructive' },
};

function getStepLabel(nodeId: string | undefined, nodes?: any[]): string {
    if (!nodeId || !nodes) return '-';
    const node = nodes.find((n: any) => n.id === nodeId);
    return node?.data?.label || nodeId;
}

export default function AdminWorkflowsPage() {
    const navigate = useNavigate();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const { data: response, isLoading, error } = useQuery<ApplicationsResponse>({
        queryKey: ['admin-applications', globalFilter, sorting, pagination],
        queryFn: () => {
            const params = new URLSearchParams();
            if (globalFilter) params.append('search', globalFilter);
            params.append('limit', pagination.pageSize.toString());
            params.append('page', (pagination.pageIndex + 1).toString());
            if (sorting.length > 0) {
                params.append('sortBy', sorting[0].id);
                params.append('sortOrder', sorting[0].desc ? 'desc' : 'asc');
            }
            return api.get<ApplicationsResponse>(`/applications?${params.toString()}`);
        },
    });

    const applications = useMemo(() => response?.data || [], [response]);

    const columns: ColumnDef<Application>[] = useMemo(() => [
        { accessorKey: 'applicationNumber', header: '申請ID', cell: ({ row }) => <strong>#{row.original.applicationNumber}</strong> },
        { id: 'appName', header: 'アプリ名', cell: ({ row }) => <TruncatedCell text={row.original.applicationDefinition?.name || row.original.applicationDefinition?.appName || '不明'} maxWidth="150px" /> },
        { accessorKey: 'title', header: '件名', cell: ({ row }) => <TruncatedCell text={row.original.title} maxWidth="200px" className="font-semibold" /> },
        { id: 'applicantId', header: '申請者', cell: ({ row }) => <UserDisplay user={row.original.applicantInfo} fallback={row.original.applicantId} /> },
        { accessorKey: 'status', header: 'ステータス', cell: ({ row }) => {
            const s = row.getValue('status') as string;
            const c = statusConfig[s] || { label: s, variant: 'outline' as const };
            return <Badge variant={c.variant}>{c.label}</Badge>;
        }},
        { id: 'currentStep', header: '現在ステップ', cell: ({ row }) => <TruncatedCell text={getStepLabel(row.original.currentNodeId, row.original.flowNodes || row.original.flowDefinition?.nodes)} maxWidth="150px" /> },
        { 
            accessorKey: 'createdAt', 
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 hover:bg-transparent">
                    申請日時 <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => new Date(row.getValue('createdAt') as string).toLocaleString('ja-JP') 
        },
        { accessorKey: 'updatedAt', header: '更新日時', cell: ({ row }) => new Date(row.getValue('updatedAt') as string).toLocaleString('ja-JP') },
        { id: 'actions', header: '操作', cell: ({ row }) => (
            <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/applications/${row.original.id}`); }} title="詳細を見る">
                    <Eye className="h-3 w-3 mr-1" />詳細
                </Button>
            </div>
        )},
    ], [navigate]);

    const table = useReactTable({ 
        data: applications, 
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
            <div><h2 className="text-3xl font-bold tracking-tight">ワークフロー進捗一覧</h2><p className="text-muted-foreground">全申請の進捗を確認できます</p></div>
            <div className="flex items-center py-4"><Input placeholder="件名、アプリ名、申請者で検索..." value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm" /></div>
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                {isLoading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                    <Table>
                        <TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id} className="whitespace-nowrap">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/workflows/${row.original.id}`)}>
                                    {row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className="whitespace-nowrap">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">申請がありません</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                )}
            </div>
            <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">{response?.pagination?.total || 0} 件中 {applications.length} 件を表示</p>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>前へ</Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
