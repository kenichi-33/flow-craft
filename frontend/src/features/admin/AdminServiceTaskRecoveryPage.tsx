import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { TruncatedCell } from '@/components/common/TruncatedCell';

interface FlowNode {
    id: string;
    data?: {
        label?: string;
        title?: string;
    };
}

interface Task {
    id: string;
    type: string;
    status: string;
    stepId: string;
    error: string | null;
    retries: number;
    createdAt: string;
    updatedAt: string;
    application: {
        id: string;
        applicationNumber: number;
        title: string;
        applicationDefinition?: { appName: string; name?: string };
        flowDefinition?: { nodes: FlowNode[] };
        flowNodes?: FlowNode[];
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

export default function AdminServiceTaskRecoveryPage() {
    const queryClient = useQueryClient();
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(globalFilter), 500);
        return () => clearTimeout(timer);
    }, [globalFilter]);

    const { data: response, isLoading, error } = useQuery<TasksResponse>({
        queryKey: ['admin-failed-tasks', debouncedSearch, pagination],
        queryFn: () => {
            const params = new URLSearchParams();
            params.append('page', (pagination.pageIndex + 1).toString());
            params.append('limit', pagination.pageSize.toString());
            if (debouncedSearch) params.append('search', debouncedSearch);
            return api.get<TasksResponse>(`/tasks/admin/failed?${params.toString()}`);
        },
    });

    const tasks = useMemo(() => response?.data || [], [response]);

    const retryMutation = useMutation({
        mutationFn: (taskIds: string[]) => api.post<{ succeeded: string[], failed: string[] }>('/workflow/tasks/retry-batch', { taskIds }),
        onSuccess: (data) => {
            const { succeeded, failed } = data;
            if (succeeded.length > 0) toast.success(`${succeeded.length} 件のタスクを再実行キューに入れました`);
            if (failed.length > 0) toast.error(`${failed.length} 件のタスクの再実行に失敗しました`);
            setRowSelection({});
            queryClient.invalidateQueries({ queryKey: ['admin-failed-tasks'] });
        },
        onError: () => {
            toast.error('再実行リクエストに失敗しました');
        }
    });

    const handleRetrySelected = () => {
        const selectedIds = Object.keys(rowSelection).filter(id => rowSelection[id]);
        if (selectedIds.length === 0) return;
        if (!confirm(`${selectedIds.length} 件のタスクを再実行しますか？`)) return;
        retryMutation.mutate(selectedIds);
    };

    const columns: ColumnDef<Task>[] = useMemo(() => [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        { id: 'applicationNumber', header: '申請ID', cell: ({ row }) => <strong>#{row.original.application?.applicationNumber || '-'}</strong> },
        { id: 'appName', header: 'アプリ名', cell: ({ row }) => <TruncatedCell text={row.original.application?.applicationDefinition?.appName || row.original.application?.applicationDefinition?.name || '不明'} maxWidth="150px" /> },
        { id: 'title', header: '件名', cell: ({ row }) => <TruncatedCell text={row.original.application?.title || '無題'} maxWidth="150px" /> },
        { 
            id: 'stepName', 
            header: 'ステップ', 
            cell: ({ row }) => {
                const nodes = row.original.application?.flowNodes || row.original.application?.flowDefinition?.nodes || [];
                const node = nodes.find((n: FlowNode) => n.id === row.original.stepId);
                const label = node?.data?.label || node?.data?.title || row.original.stepId;
                return <TruncatedCell text={label} maxWidth="120px" />;
            } 
        },
        { id: 'type', header: 'タイプ', cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge> },
        { id: 'error', header: 'エラー内容', cell: ({ row }) => <TruncatedCell text={row.original.error} maxWidth="200px" className="text-destructive font-mono text-xs" /> },
        { id: 'retries', header: 'リトライ数', cell: ({ row }) => row.original.retries },
        { id: 'updatedAt', header: '最終更新', cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString('ja-JP') },
    ], []);

    const table = useReactTable({
        data: tasks,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: response?.pagination?.totalPages ?? -1,
        onPaginationChange: setPagination,
        onRowSelectionChange: setRowSelection,
        getRowId: row => row.id,
        state: { rowSelection, pagination },
    });

    if (error) return <div className="p-8 text-center text-destructive">データの取得に失敗しました</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">サービスタスク回復</h2>
                    <p className="text-muted-foreground">自動実行に失敗したタスクを確認・再実行します</p>
                </div>
                <Button 
                    onClick={handleRetrySelected} 
                    disabled={Object.keys(rowSelection).length === 0 || retryMutation.isPending}
                >
                    {retryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    選択したタスクを再実行
                </Button>
            </div>

            <div className="flex items-center space-x-2 w-full max-w-sm">
                <Input
                    placeholder="検索 (件名, アプリ名, ステップ...)"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="flex-1"
                />
            </div>

            <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                {isLoading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((hg) => (
                                <TableRow key={hg.id}>
                                    {hg.headers.map((h) => (
                                        <TableHead key={h.id}>
                                            {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        失敗したタスクはありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
