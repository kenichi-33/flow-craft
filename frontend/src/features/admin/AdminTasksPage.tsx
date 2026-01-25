import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, ArrowUpDown } from 'lucide-react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { TruncatedCell } from '@/components/common/TruncatedCell';

interface Task {
    id: string;
    status: string;
    stepId: string;
    assignedTo?: string;
    assignedToInfo?: UserSnapshot;
    createdAt: string;
    application: {
        id: string;
        applicationNumber: number;
        title: string;
        applicantId: string;
        applicantInfo?: UserSnapshot;
        applicationDefinition?: { appName: string; name?: string };
        flowDefinition?: { nodes: any[] };
    };
}

interface TasksResponse { 
    data: Task[]; 
    pagination: { 
        total: number; 
        page: number; 
        limit: number; 
        totalPages: number; 
    }; 
}

function getStepLabel(stepId: string, nodes?: any[]): string {
    if (!nodes) return stepId;
    const node = nodes.find((n: any) => n.id === stepId);
    return node?.data?.label || stepId;
}

function formatAssignedTo(assignedTo?: string): string {
    if (!assignedTo) return '未指定';
    return assignedTo.split(',').map(s => s.trim()).map(a => {
        if (a.startsWith('user:')) return a.substring(5);
        if (a.startsWith('role:')) return `ロール: ${a.substring(5)}`;
        if (a.startsWith('group:')) return `グループ: ${a.substring(6)}`;
        if (a === 'applicant') return '申請者';
        return a;
    }).join(', ');
}

export default function AdminTasksPage() {
    const navigate = useNavigate();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const { data: response, isLoading, error } = useQuery<TasksResponse>({
        queryKey: ['admin-tasks', globalFilter, statusFilter, sorting, pagination],
        queryFn: () => {
            const params = new URLSearchParams();
            if (globalFilter) params.append('search', globalFilter);
            if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
            params.append('limit', pagination.pageSize.toString());
            params.append('page', (pagination.pageIndex + 1).toString());
            if (sorting.length > 0) {
                params.append('sortBy', sorting[0].id);
                params.append('sortOrder', sorting[0].desc ? 'desc' : 'asc');
            }
            return api.get<TasksResponse>(`/tasks?${params.toString()}`);
        },
    });

    const tasks = useMemo(() => response?.data || [], [response]);

    const columns: ColumnDef<Task>[] = useMemo(() => [
        { id: 'applicationNumber', header: '申請ID', cell: ({ row }) => <strong>#{row.original.application?.applicationNumber || '-'}</strong> },
        { id: 'appName', header: 'アプリ名', cell: ({ row }) => <TruncatedCell text={row.original.application?.applicationDefinition?.appName || row.original.application?.applicationDefinition?.name || '不明'} maxWidth="150px" /> },
        { id: 'title', header: '件名', cell: ({ row }) => <TruncatedCell text={row.original.application?.title || '無題'} maxWidth="200px" className="font-semibold" /> },
        { id: 'applicantId', header: '申請者', cell: ({ row }) => <UserDisplay user={row.original.application?.applicantInfo} fallback={row.original.application?.applicantId} /> },
        { id: 'assignedTo', header: '担当者', cell: ({ row }) => <UserDisplay user={row.original.assignedToInfo} fallback={formatAssignedTo(row.original.assignedTo)} /> },
        { id: 'stepId', header: 'ステップ', cell: ({ row }) => <TruncatedCell text={getStepLabel(row.original.stepId, row.original.application?.flowDefinition?.nodes)} maxWidth="150px" /> },
        { accessorKey: 'status', header: 'ステータス', cell: ({ row }) => {
            const s = row.getValue('status') as string;
            return <Badge variant={s === 'PENDING' ? 'secondary' : 'default'}>{s === 'PENDING' ? '保留中' : s === 'COMPLETED' ? '完了' : s}</Badge>;
        }},
        { 
            accessorKey: 'createdAt', 
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="-ml-4 hover:bg-transparent">
                    発生日 <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => new Date(row.getValue('createdAt') as string).toLocaleDateString('ja-JP') 
        },
        { id: 'actions', header: '操作', cell: ({ row }) => (
            <Button 
                variant={row.original.status === 'PENDING' ? "default" : "ghost"} 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${row.original.id}`); }}
            >
                <Edit className="h-3 w-3 mr-1" />
                {row.original.status === 'PENDING' ? '処理' : '詳細'}
            </Button>
        ) },
    ], [navigate]);

    const table = useReactTable({ 
        data: tasks, 
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
            <div><h2 className="text-3xl font-bold tracking-tight">タスク全量管理</h2><p className="text-muted-foreground">全ユーザーの未処理タスクを確認</p></div>
            <div className="flex items-center gap-4 py-4">
                <Input 
                    placeholder="検索..." 
                    value={globalFilter ?? ''} 
                    onChange={(e) => setGlobalFilter(e.target.value)} 
                    className="max-w-sm" 
                />
                <select 
                    className="h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="PENDING">未処理 (PENDING)</option>
                    <option value="COMPLETED">完了 (COMPLETED)</option>
                    <option value="ALL">すべて</option>
                </select>
            </div>
            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                {isLoading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                    <Table>
                        <TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id} className={`whitespace-nowrap ${h.column.id === 'actions' ? 'sticky right-0 bg-background shadow-[-1px_0_0_0_hsl(var(--border))] z-10' : ''}`}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tasks/${row.original.id}`)}>
                                    {row.getVisibleCells().map((cell) => (<TableCell key={cell.id} className={`whitespace-nowrap ${cell.column.id === 'actions' ? 'sticky right-0 bg-background shadow-[-1px_0_0_0_hsl(var(--border))]' : ''}`}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}
                                </TableRow>
                            )) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">タスクがありません</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                )}
            </div>
            <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">{response?.pagination?.total || 0} 件中 {tasks.length} 件を表示</p>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>前へ</Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
