import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Info } from 'lucide-react';

interface User {
    id: string;
    username: string;
    displayName: string;
    email: string;
    enabled: boolean;
    position: string;
    groups: string[];
    roles: string[];
}

const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    wf_admin: { label: '管理者', variant: 'destructive' },
    wf_manager: { label: '管理職', variant: 'default' },
    wf_approver: { label: '承認者', variant: 'secondary' },
    wf_user: { label: '利用者', variant: 'outline' },
};

export default function AdminUsersPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['users', searchQuery],
        queryFn: async () => {
            const q = searchQuery || '*';
            const res = await api.get<any>(`/users/search?q=${encodeURIComponent(q)}&limit=50`);
            return res.data || res;
        },
    });

    const users: User[] = useMemo(() => Array.isArray(data) ? data : (data?.data || []), [data]);

    const columns: ColumnDef<User>[] = useMemo(() => [
        {
            id: 'displayName',
            header: '氏名',
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{(row.original.displayName || row.original.username)[0]}</AvatarFallback></Avatar>
                    <div>
                        <p className="font-medium">{row.original.displayName || row.original.username}</p>
                        <p className="text-xs text-muted-foreground">@{row.original.username}</p>
                    </div>
                </div>
            ),
        },
        { accessorKey: 'email', header: 'メールアドレス' },
        { accessorKey: 'position', header: '役職' },
        {
            id: 'groups',
            header: '所属部署',
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {(row.original.groups || []).map((g) => (
                        <Badge key={g} variant="outline" className="text-xs">{g.split('/').pop()}</Badge>
                    ))}
                </div>
            ),
        },
        {
            id: 'roles',
            header: '権限',
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {(row.original.roles || []).map((r) => {
                        const c = roleConfig[r] || { label: r, variant: 'outline' as const };
                        return <Badge key={r} variant={c.variant} className="text-xs">{c.label}</Badge>;
                    })}
                </div>
            ),
        },
        {
            accessorKey: 'enabled',
            header: 'ステータス',
            cell: ({ row }) => (
                <Badge variant={row.original.enabled ? 'default' : 'secondary'}>
                    {row.original.enabled ? '有効' : '無効'}
                </Badge>
            ),
        },
    ], []);

    const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), getFilteredRowModel: getFilteredRowModel() });

    if (error) return <div className="flex items-center justify-center h-64"><p className="text-destructive">データの取得に失敗しました</p></div>;

    return (
        <div className="space-y-6">
            <Button variant="ghost" asChild><Link to="/admin"><ArrowLeft className="h-4 w-4 mr-2" />ダッシュボード</Link></Button>

            <div><h2 className="text-3xl font-bold tracking-tight">ユーザー管理</h2><p className="text-muted-foreground">Keycloakに登録されているユーザー一覧</p></div>

            <Alert><Info className="h-4 w-4" /><AlertDescription>ユーザーはKeycloakで管理されています。追加・編集・削除はKeycloak管理コンソールから行ってください。</AlertDescription></Alert>

            <div className="flex items-center gap-4">
                <Input placeholder="名前またはユーザー名で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm" onKeyDown={(e) => e.key === 'Enter' && refetch()} />
                <Button variant="outline" onClick={() => refetch()}>検索</Button>
            </div>

            <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                    {isLoading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                        <Table>
                            <TableHeader>{table.getHeaderGroups().map((hg) => (<TableRow key={hg.id}>{hg.headers.map((h) => (<TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
                            <TableBody>
                                {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>
                                )) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">ユーザーが見つかりません</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{users.length} 件</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>前へ</Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>次へ</Button>
                </div>
            </div>
        </div>
    );
}
