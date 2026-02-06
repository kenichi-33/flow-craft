import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Eye, Edit, ArrowUpDown, Search, ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
    applicationDefinition?: {
        id: number;
        name: string;
    };
    flowDefinition?: {
        nodes: any[];
    };
    flowNodes?: any[];
    isTestMode?: boolean;
}

interface ApplicationsResponse {
    data: Application[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    DRAFT: { label: '下書き', variant: 'outline' },
    IN_PROGRESS: { label: '処理中', variant: 'secondary' },
    APPROVED: { label: '完了', variant: 'default' },
    REJECTED: { label: '却下', variant: 'destructive' },
    REMANDED: { label: '差戻し', variant: 'destructive' },
    CANCELED: { label: '取下げ', variant: 'outline' },
    COMPLETED: { label: '完了', variant: 'default' },
};

function getStepLabel(nodeId: string | undefined, nodes?: any[]): string {
    if (!nodeId || !nodes) return '-';
    const node = nodes.find((n: any) => n.id === nodeId);
    return node?.data?.label || nodeId || '-';
}

export default function ApplicationListPage() {
    const navigate = useNavigate();
    const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [activeTab, setActiveTab] = useState('all');

    const [myApplications, setMyApplications] = useState(true);
    const [showTestMode, setShowTestMode] = useState(false);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 15 });
    
    // Server-side fetching
    const { data: applicationsResponse, isLoading, error } = useQuery<ApplicationsResponse>({
        queryKey: ['applications', { myApplications, globalFilter, activeTab, pagination, sorting, showTestMode }],
        queryFn: () => {
             const searchParams = new URLSearchParams();
             searchParams.append('limit', pagination.pageSize.toString());
             searchParams.append('page', (pagination.pageIndex + 1).toString());
             if (myApplications) searchParams.append('myApplications', 'true');
             if (showTestMode) searchParams.append('isTestMode', 'true');
             else searchParams.append('isTestMode', 'false');

             if (globalFilter) searchParams.append('search', globalFilter); // サーバー側で件名・申請者名等を検索

             if (sorting.length > 0) {
                 searchParams.append('sortBy', sorting[0].id);
                 searchParams.append('sortOrder', sorting[0].desc ? 'desc' : 'asc');
             }

             if (activeTab === 'in_progress') {
                 searchParams.append('status', 'IN_PROGRESS,DRAFT');
             } else if (activeTab === 'completed') {
                 searchParams.append('status', 'APPROVED');
             } else if (activeTab === 'rejected') {
                 searchParams.append('status', 'REJECTED,REMANDED,CANCELED');
             }

             return api.get<ApplicationsResponse>(`/applications?${searchParams.toString()}`);
        },
    });

    const applications = useMemo(() => applicationsResponse?.data || [], [applicationsResponse]);
    const filteredByTab = applications; 

    const columns: ColumnDef<Application>[] = useMemo(() => [
        {
            accessorKey: 'applicationNumber',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    申請ID
                    {column.getIsSorted() === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
            ),
            cell: ({ row }) => <strong>#{row.original.applicationNumber}</strong>,
        },
        {
            id: 'applicationDefinition',
            accessorKey: 'applicationDefinition.name',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    アプリ名
                    {column.getIsSorted() === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
            ),
            cell: ({ row }) => <TruncatedCell text={row.original.applicationDefinition?.name || '不明'} maxWidth="150px" />,
        },
        {
            accessorKey: 'title',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    件名
                    {column.getIsSorted() === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.isTestMode && <Badge variant="destructive" className="px-1 py-0 text-[10px]">TEST</Badge>}
                    <TruncatedCell text={row.original.title} maxWidth="200px" className="font-semibold" />
                </div>
            ),
        },
        {
            id: 'applicantId',
            accessorKey: 'applicantId',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    申請者
                    {column.getIsSorted() === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
            ),
            cell: ({ row }) => <UserDisplay user={row.original.applicantInfo} fallback={row.original.applicantId} />,
        },
        {
            accessorKey: 'status',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    ステータス
                    {column.getIsSorted() === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
            ),
            cell: ({ row }) => {
                const status = row.getValue('status') as string;
                const config = statusConfig[status] || { label: status, variant: 'outline' as const };
                return <Badge variant={config.variant}>{config.label}</Badge>;
            },
        },
        {
            id: 'currentStep',
            header: '現在のステップ',
            cell: ({ row }) => {
                const nodes = row.original.flowNodes || row.original.flowDefinition?.nodes || [];
                return <TruncatedCell text={getStepLabel(row.original.currentNodeId, nodes)} maxWidth="150px" />;
            },
        },
        {
            accessorKey: 'createdAt',
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="p-0 hover:bg-transparent">
                    申請日時
                    {column.getIsSorted() === "asc" ? <ArrowUp className="ml-2 h-4 w-4" /> : column.getIsSorted() === "desc" ? <ArrowDown className="ml-2 h-4 w-4" /> : <ArrowUpDown className="ml-2 h-4 w-4" />}
                </Button>
            ),
            cell: ({ row }) => new Date(row.getValue('createdAt') as string).toLocaleString('ja-JP'),
        },
        {
            accessorKey: 'updatedAt',
            header: '更新日時',
            cell: ({ row }) => new Date(row.getValue('updatedAt') as string).toLocaleString('ja-JP'),
        },
        {
            id: 'actions',
            header: '操作',
            cell: ({ row }) => (
                <div className="flex gap-1 justify-end">
                    {['REMANDED', 'DRAFT'].includes(row.original.status) ? (
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); navigate(`/applications/${row.original.id}/edit`); }}
                            className={`${row.original.status === 'DRAFT' ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90' : 'bg-orange-500 hover:bg-orange-600'}`}
                        >
                            <Edit className="h-3 w-3 mr-1" />{row.original.status === 'DRAFT' ? '編集' : '再編集'}
                        </Button>
                    ) : (
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/applications/${row.original.id}`); }}>
                            <Eye className="h-3 w-3 mr-1" />詳細
                        </Button>
                    )}
                </div>
            ),
            meta: { stickyRight: true },
        },
    ], [navigate]);

    const table = useReactTable({
        data: applications, 
        columns, 
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        pageCount: applicationsResponse?.pagination.totalPages ?? -1,
        onPaginationChange: setPagination,
        onSortingChange: setSorting,
        state: { sorting, pagination }, 
    });

    if (error) return <div className="flex items-center justify-center h-64"><p className="text-destructive">データの取得に失敗しました</p></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">申請一覧</h2>
                    <p className="text-muted-foreground">あなたの申請履歴を確認できます</p>
                </div>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 border p-2 rounded-md bg-card">
                        <Checkbox id="my-apps" checked={myApplications} onCheckedChange={(c) => setMyApplications(!!c)} />
                        <Label htmlFor="my-apps" className="cursor-pointer text-sm font-medium">自分の申請のみ</Label>
                    </div>
                    <div className="flex items-center gap-2 border p-2 rounded-md bg-card">
                        <Checkbox id="test-mode" checked={showTestMode} onCheckedChange={(c) => setShowTestMode(!!c)} />
                        <Label htmlFor="test-mode" className="cursor-pointer text-sm font-medium text-destructive">テストモード表示</Label>
                    </div>
                    <Button asChild><Link to="/applications/new"><Plus className="h-4 w-4 mr-2" />新規申請</Link></Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <TabsList>
                        <TabsTrigger value="all">すべて</TabsTrigger>
                        <TabsTrigger value="in_progress">進行中</TabsTrigger>
                        <TabsTrigger value="completed">完了</TabsTrigger>
                        <TabsTrigger value="rejected">却下・差戻し・取下げ</TabsTrigger>
                    </TabsList>
                    
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="件名、アプリ名、申請者で検索..." 
                            value={globalFilter ?? ''} 
                            onChange={(e) => setGlobalFilter(e.target.value)} 
                            className="pl-9 w-full" 
                        />
                    </div>
                </div>

                <TabsContent value={activeTab} className="mt-0">
                    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    {table.getHeaderGroups().map((hg) => (
                                        <TableRow key={hg.id}>
                                            {hg.headers.map((h) => {
                                                const isStickyRight = (h.column.columnDef.meta as any)?.stickyRight;
                                                return (
                                                    <TableHead 
                                                        key={h.id} 
                                                        className={`whitespace-nowrap ${isStickyRight ? 'sticky right-0 z-20 bg-card shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                                                    >
                                                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                                                    </TableHead>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableHeader>
                                <TableBody>
                                    {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/applications/${row.original.id}`)}>
                                            {row.getVisibleCells().map((cell) => {
                                                const isStickyRight = (cell.column.columnDef.meta as any)?.stickyRight;
                                                return (
                                                    <TableCell 
                                                        key={cell.id} 
                                                        className={`whitespace-nowrap ${isStickyRight ? 'sticky right-0 z-10 bg-card shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                                                    >
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    )) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center">申請がありません</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between py-4">
                <p className="text-sm text-muted-foreground">{applicationsResponse?.pagination.total || 0} 件中 {filteredByTab.length} 件を表示</p>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>前へ</Button>
                    <span className="text-sm flex items-center">{pagination.pageIndex + 1} / {Math.ceil((applicationsResponse?.pagination.total || 0) / pagination.pageSize) || 1}</span>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
