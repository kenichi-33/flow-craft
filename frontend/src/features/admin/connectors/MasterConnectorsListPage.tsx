import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Database, Globe, FileSpreadsheet, Pencil, Trash2, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function MasterConnectorsListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');

    const { data: connectors, isLoading } = useQuery({
        queryKey: ['master-connectors'],
        queryFn: async () => {
            return api.get<any[]>('/master-connectors');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return api.delete(`/master-connectors/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['master-connectors'] });
            toast.success('コネクタを削除しました');
        },
        onError: () => {
            toast.error('削除に失敗しました');
        }
    });

    const filteredConnectors = connectors?.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.description?.toLowerCase().includes(search.toLowerCase())
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'rest': return <Globe className="h-4 w-4" />;
            case 'sql': return <Database className="h-4 w-4" />;
            case 'csv': return <FileSpreadsheet className="h-4 w-4" />;
            default: return <Link className="h-4 w-4" />;
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">マスター連携設定</h1>
                    <p className="text-muted-foreground mt-1">
                        外部データソースとの接続設定を管理します。
                    </p>
                </div>
                <Button onClick={() => navigate('/admin/connectors/new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    新規作成
                </Button>
            </div>

            <div className="flex items-center gap-4 bg-background p-1">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="コネクタを検索..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>名前 / 説明</TableHead>
                            <TableHead>タイプ</TableHead>
                            <TableHead>公開設定</TableHead>
                            <TableHead>最終更新</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">読み込み中...</TableCell>
                            </TableRow>
                        ) : filteredConnectors?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    コネクタが見つかりません
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredConnectors?.map((connector) => (
                                <TableRow key={connector.id}>
                                    <TableCell className="text-center">
                                         <div className="flex items-center justify-center text-muted-foreground">
                                             {getIcon(connector.type)}
                                         </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{connector.name}</div>
                                        {connector.description && (
                                            <div className="text-xs text-muted-foreground max-w-sm truncate">
                                                {connector.description}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="uppercase text-[10px]">
                                            {connector.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={connector.isShared ? "secondary" : "outline"}>
                                            {connector.isShared ? '全体公開' : '限定公開'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(connector.updatedAt).toLocaleString('ja-JP')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                onClick={() => navigate(`/admin/connectors/${connector.id}`)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    if (confirm('本当に削除しますか？')) {
                                                        deleteMutation.mutate(connector.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
