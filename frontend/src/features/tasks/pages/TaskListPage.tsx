import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    useReactTable, 
    getCoreRowModel, 
    flexRender, 
    type ColumnDef, 
    type SortingState 
} from '@tanstack/react-table';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, Search, ArrowUpDown } from 'lucide-react';
import { UserDisplay, type UserSnapshot } from '@/components/common/UserDisplay';
import { Label } from '@/components/ui/label';
import { TruncatedCell } from '@/components/common/TruncatedCell';

interface Task {
    id: string;
    taskType: string;
    status: string;
    stepId: string;
    assigneeType: string;
    assigneeId: string;
    assignedTo?: string;
    assignedToInfo?: UserSnapshot;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
    application: {
        id: string;
        applicationNumber: number;
        title: string;
        status: string;
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
    }
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
        if (a === 'applicant_manager') return '申請者の上長';
        return a;
    }).join(', ');
}

export default function TaskListPage() {
    const navigate = useNavigate();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const { data: tasksResponse, isLoading, error } = useQuery<TasksResponse>({
        queryKey: ['tasks', { myTasks: 'true', status: 'PENDING', globalFilter, dateFrom, dateTo, sorting, pagination }],
        queryFn: () => {
            const params: any = { 
                status: 'PENDING', 
                limit: pagination.pageSize,
                page: pagination.pageIndex + 1,
            };
            if (globalFilter) params.search = globalFilter;
            if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString();
            if (dateTo) params.dateTo = new Date(dateTo).toISOString();
            // Server side sorting
            if (sorting.length > 0) {
                params.sortBy = sorting[0].id;
                params.sortOrder = sorting[0].desc ? 'desc' : 'asc';
            }
            // My Tasks (always true for this page according to requirement "your tasks")
            params.myTasks = 'true';
            
            return api.get<TasksResponse>(`/tasks?${new URLSearchParams(params).toString()}`);
        },
    });

    const tasks = useMemo(() => tasksResponse?.data || [], [tasksResponse]);

    const columns: ColumnDef<Task>[] = useMemo(() => [
        {
            id: 'applicationNumber',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    申請ID
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <strong>#{row.original.application?.applicationNumber || '-'}</strong>
        },
        {
            id: 'appName',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    アプリ名
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <TruncatedCell text={row.original.application?.applicationDefinition?.appName || row.original.application?.applicationDefinition?.name || '不明'} maxWidth="150px" />
        },
        {
            id: 'title',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    件名
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <TruncatedCell text={row.original.application?.title || '無題'} maxWidth="200px" className="font-semibold" />
        },
        {
            id: 'applicantId',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    申請者
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <UserDisplay user={row.original.application?.applicantInfo} fallback={row.original.application?.applicantId} />
        },
        {
            id: 'assignedTo',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    担当者
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => <UserDisplay user={row.original.assignedToInfo} fallback={formatAssignedTo(row.original.assignedTo || row.original.assigneeId)} />
        },
        { id: 'stepId', header: '現在のステップ', cell: ({ row }) => <TruncatedCell text={getStepLabel(row.original.stepId, row.original.application?.flowDefinition?.nodes)} maxWidth="150px" /> },
        { 
            accessorKey: 'status', 
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    ステータス
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const s = row.getValue('status') as string;
                return <Badge variant={s === 'PENDING' ? 'secondary' : s === 'COMPLETED' ? 'default' : 'destructive'}>{s === 'PENDING' ? '保留中' : s === 'COMPLETED' ? '完了' : s}</Badge>;
            }
        },
        { 
            id: 'dueDate', 
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    期限
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => row.original.dueDate ? new Date(row.original.dueDate).toLocaleDateString('ja-JP') : '-'
        },
        { 
            accessorKey: 'createdAt', 
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    作成日時
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => new Date(row.getValue('createdAt') as string).toLocaleString('ja-JP') 
        },
        { 
            accessorKey: 'updatedAt', 
            header: '更新日時',
            cell: ({ row }) => row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleString('ja-JP') : '-'
        },
        { id: 'actions', header: '操作', cell: ({ row }) => <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${row.original.id}`); }}><Edit className="h-3 w-3 mr-1" />処理</Button> },
    ], [navigate]);
    const table = useReactTable({ 
        data: tasks, 
        columns, 
        getCoreRowModel: getCoreRowModel(), 
        // getPaginationRowModel: getPaginationRowModel(), // Disable client pagination
        manualPagination: true,
        pageCount: tasksResponse?.pagination.totalPages ?? -1,
        onPaginationChange: setPagination,
        manualSorting: true,
        onSortingChange: setSorting, 
        // onGlobalFilterChange: setGlobalFilter, 
        state: { sorting, pagination } // globalFilter is separate
    });

    if (error) return <div className="flex items-center justify-center h-64"><p className="text-destructive">データの取得に失敗しました</p></div>;

    return (
        <div className="space-y-6">
            <div><h2 className="text-3xl font-bold tracking-tight">タスク管理</h2><p className="text-muted-foreground">承認待ちのタスクを確認・処理できます</p></div>
            <div className="flex flex-col sm:flex-row gap-4 py-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="件名、アプリ名、申請者で検索..."
                        className="pl-8"
                        value={globalFilter ?? ''}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <div className="grid gap-1.5">
                        <Label htmlFor="dateFrom" className="text-xs">開始日</Label>
                        <Input
                            id="dateFrom"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-40"
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="dateTo" className="text-xs">終了日</Label>
                        <Input
                            id="dateTo"
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-40"
                        />
                    </div>
                </div>
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
                <p className="text-sm text-muted-foreground">{tasksResponse?.pagination.total || 0} 件中 {tasks.length} 件を表示</p>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>前へ</Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
