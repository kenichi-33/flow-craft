import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Info, Plus, Trash2, UserPlus, Building, Users, Folder } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

interface Department { path: string; name: string; }
interface Team { id: string; name: string; description?: string; members: { id: string; memberType: string; memberId: string }[]; }

function DepartmentsTab() {
    const { data: departments, isLoading } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => api.get('/users/departments') });
    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    return (
        <div className="space-y-4">
            <Alert><Info className="h-4 w-4" /><AlertDescription>部署は会社の組織構造を表します。変更はKeycloak管理コンソールから行ってください。</AlertDescription></Alert>
            {(!departments || departments.length === 0) ? (
                <p className="text-muted-foreground text-center py-8">部署が登録されていません</p>
            ) : (
                <div className="space-y-1">
                    {departments.map((dept) => (
                        <div key={dept.path} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50" style={{ paddingLeft: `${(dept.path.split('/').length - 1) * 16}px` }}>
                            {dept.path === '/Company' ? <Building className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                            <span className="font-medium">{dept.name}</span>
                            <span className="text-xs text-muted-foreground">{dept.path}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function TeamsTab() {
    const queryClient = useQueryClient();
    const hasRole = useAuthStore((s) => s.hasRole);
    const isAdmin = hasRole('wf_admin');
    const [createOpen, setCreateOpen] = useState(false);
    const [memberOpen, setMemberOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [memberId, setMemberId] = useState('');
    const [memberType, setMemberType] = useState<'user' | 'department'>('user');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: teams, isLoading } = useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => api.get('/teams') });
    const { data: departments } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => api.get('/users/departments') });
    const { data: searchResults } = useQuery<any[]>({ queryKey: ['user-search', searchQuery], queryFn: () => api.get(`/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`).then((r: any) => r.data || r), enabled: searchQuery.length > 0 });

    const createMutation = useMutation({ mutationFn: (d: any) => api.post('/teams', d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); setCreateOpen(false); setNewName(''); setNewDesc(''); } });
    const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/teams/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }) });
    const addMemberMutation = useMutation({ mutationFn: (d: any) => api.post(`/teams/${d.teamId}/members`, d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); setMemberOpen(false); setMemberId(''); setSearchQuery(''); } });
    const removeMemberMutation = useMutation({ mutationFn: (d: any) => api.delete(`/teams/${d.teamId}/members/${d.memberId}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }) });

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <Alert><Info className="h-4 w-4" /><AlertDescription>チームはプロジェクトや業務グループなど、任意に作成できるグループです。</AlertDescription></Alert>
            {isAdmin && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />新規チーム作成</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>新規チーム作成</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>チーム名</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例: プロジェクトA" /></div>
                            <div className="space-y-2"><Label>説明（任意）</Label><Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} /></div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>キャンセル</Button>
                            <Button onClick={() => createMutation.mutate({ name: newName, description: newDesc || undefined })} disabled={!newName || createMutation.isPending}>作成</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            {(!teams || teams.length === 0) ? (
                <p className="text-muted-foreground text-center py-8">チームがまだ作成されていません</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {teams.map((team) => (
                        <Card key={team.id} className="border-0 shadow-sm">
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><CardTitle className="text-lg">{team.name}</CardTitle></div>
                                {team.description && <p className="text-sm text-muted-foreground">{team.description}</p>}
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm font-medium mb-2">メンバー ({team.members?.length || 0})</p>
                                {team.members && team.members.length > 0 ? (
                                    <div className="space-y-1">
                                        {team.members.map((m) => (
                                            <div key={m.id} className="flex items-center justify-between text-sm p-1 rounded hover:bg-muted/50">
                                                <div className="flex items-center gap-2">
                                                    {m.memberType === 'user' ? <Avatar className="h-6 w-6"><AvatarFallback className="text-xs">{((m as any).memberInfo?.displayName || m.memberId)[0].toUpperCase()}</AvatarFallback></Avatar> : <Folder className="h-4 w-4" />}
                                                    <span>{(m as any).memberInfo?.displayName || m.memberId}</span>
                                                    {(m as any).memberInfo?.department && <span className="text-xs text-muted-foreground">{(m as any).memberInfo.department}</span>}
                                                    <Badge variant="outline" className="text-xs">{m.memberType === 'user' ? 'ユーザー' : '部署'}</Badge>
                                                </div>
                                                {isAdmin && <Button variant="ghost" size="sm" onClick={() => removeMemberMutation.mutate({ teamId: team.id, memberId: m.memberId })}><Trash2 className="h-3 w-3" /></Button>}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">メンバーなし</p>}
                            </CardContent>
                            {isAdmin && (
                                <CardFooter className="gap-2">
                                    <Button variant="outline" size="sm" onClick={() => { setSelectedTeam(team.id); setMemberOpen(true); }}><UserPlus className="h-3 w-3 mr-1" />追加</Button>
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(team.id)}><Trash2 className="h-3 w-3 mr-1" />削除</Button>
                                </CardFooter>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>メンバー追加</DialogTitle><DialogDescription>ユーザーまたは部署を追加できます</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex gap-2">
                            <Button variant={memberType === 'user' ? 'default' : 'outline'} onClick={() => { setMemberType('user'); setMemberId(''); }}>ユーザー</Button>
                            <Button variant={memberType === 'department' ? 'default' : 'outline'} onClick={() => { setMemberType('department'); setMemberId(''); }}>部署</Button>
                        </div>
                        {memberType === 'user' ? (
                            <div className="space-y-2">
                                <Input placeholder="ユーザー名で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                {searchResults && searchResults.length > 0 && (
                                    <div className="border rounded-md max-h-48 overflow-auto">
                                        {searchResults.map((u: any) => (
                                            <div key={u.username} className={`p-2 cursor-pointer hover:bg-muted ${memberId === u.username ? 'bg-muted' : ''}`} onClick={() => setMemberId(u.username)}>
                                                {u.displayName || u.username} <span className="text-xs text-muted-foreground">@{u.username}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {memberId && <Badge>選択中: {memberId}</Badge>}
                            </div>
                        ) : (
                            <div className="border rounded-md max-h-48 overflow-auto">
                                {(departments || []).map((d) => (
                                    <div key={d.path} className={`p-2 cursor-pointer hover:bg-muted ${memberId === d.path ? 'bg-muted' : ''}`} onClick={() => setMemberId(d.path)}>
                                        {d.name} <span className="text-xs text-muted-foreground">{d.path}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMemberOpen(false)}>キャンセル</Button>
                        <Button onClick={() => selectedTeam && addMemberMutation.mutate({ teamId: selectedTeam, memberType, memberId })} disabled={!memberId || addMemberMutation.isPending}>追加</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function AdminTeamsPage() {
    return (
        <div className="space-y-6">
            <Button variant="ghost" asChild><Link to="/admin"><ArrowLeft className="h-4 w-4 mr-2" />ダッシュボード</Link></Button>
            <div><h2 className="text-3xl font-bold tracking-tight">組織・チーム管理</h2><p className="text-muted-foreground">部署とチームの管理</p></div>
            <Tabs defaultValue="departments">
                <TabsList><TabsTrigger value="departments"><Building className="h-4 w-4 mr-2" />部署（組織）</TabsTrigger><TabsTrigger value="teams"><Users className="h-4 w-4 mr-2" />チーム（任意）</TabsTrigger></TabsList>
                <TabsContent value="departments" className="mt-4"><DepartmentsTab /></TabsContent>
                <TabsContent value="teams" className="mt-4"><TeamsTab /></TabsContent>
            </Tabs>
        </div>
    );
}
