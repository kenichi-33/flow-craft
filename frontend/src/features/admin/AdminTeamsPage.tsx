import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Loader2, Plus, Trash2, UserPlus, Building, Users, Folder, Search, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { cn } from '@/lib/utils';

// Types
interface KeycloakGroup { id: string; name: string; path: string; deptCode?: string; }
interface LocalTeam { id: string; name: string; description?: string; members: { id: string; memberType: string; memberId: string; memberInfo?: any }[]; }
interface UserSnapshot { username: string; firstName?: string; lastName?: string; email?: string; type: 'user' | 'group' | 'role' | 'other'; }

type SelectionType = 
    | { type: 'company'; group: KeycloakGroup }
    | { type: 'shared'; group: KeycloakGroup }
    | { type: 'custom'; team: LocalTeam };

export default function AdminTeamsPage() {
    const queryClient = useQueryClient();
    const hasRole = useAuthStore((s) => s.hasRole);
    const isAdmin = hasRole('wf_admin');
    
    // Selection State
    const [selection, setSelection] = useState<SelectionType | null>(null);

    // Data Queries
    const { data: companyGroups, isLoading: isCompanyLoading } = useQuery<KeycloakGroup[]>({ 
        queryKey: ['groups', 'company'], 
        queryFn: async () => {
            const data: any = await api.get('/users/departments?root=/Company');
            return data.filter((g: any) => g.path.startsWith('/Company'));
        }
    });
    const { data: sharedTeams, isLoading: isSharedLoading } = useQuery<KeycloakGroup[]>({ 
        queryKey: ['groups', 'teams'], 
        queryFn: async () => {
            const data: any = await api.get('/users/departments?root=/Teams');
            // Filter out anything that isn't strictly under /Teams (or is /Teams itself if you want root)
            // User said "Company is displayed in Shared Teams". This implies the API returned Company groups.
            return data.filter((g: any) => g.path.startsWith('/Teams'));
        }
    });
    const { data: localTeams, isLoading: isLocalLoading } = useQuery<LocalTeam[]>({ 
        queryKey: ['teams'], 
        queryFn: () => api.get('/teams') 
    });

    // Mutations
    const createTeamMutation = useMutation({ 
        mutationFn: (d: any) => api.post('/teams', d), 
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teams'] }); setCreateOpen(false); } 
    });
    const deleteTeamMutation = useMutation({ 
        mutationFn: (id: string) => api.delete(`/teams/${id}`), 
        onSuccess: (_, variables) => { 
            queryClient.invalidateQueries({ queryKey: ['teams'] }); 
            if (selection?.type === 'custom' && selection.team.id === variables) setSelection(null); 
        } 
    });

    // Dialog States
    const [createOpen, setCreateOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');

    // --- Sidebar Components ---

    const renderGroupItem = (group: KeycloakGroup, type: 'company' | 'shared') => {
        const isSelected = selection?.type === type && selection.group.id === group.id;
        const depth = group.path.split('/').length - 2; // Adjust indentation
        
        return (
            <Button
                key={group.id}
                variant={isSelected ? "secondary" : "ghost"}
                className={cn("w-full justify-start h-9 px-2", isSelected && "font-medium")}
                style={{ paddingLeft: `${Math.max(8, depth * 12 + 8)}px` }}
                onClick={() => setSelection({ type, group })}
            >
                {type === 'company' ? <Building className="mr-2 h-4 w-4 text-muted-foreground" /> : <Folder className="mr-2 h-4 w-4 text-emerald-500" />}
                <span className="truncate">{group.name}</span>
            </Button>
        );
    };

    const renderLocalTeamItem = (team: LocalTeam) => {
        const isSelected = selection?.type === 'custom' && selection.team.id === team.id;
        return (
            <Button
                key={team.id}
                variant={isSelected ? "secondary" : "ghost"}
                className={cn("w-full justify-start h-9 px-2 group", isSelected && "font-medium")}
                onClick={() => setSelection({ type: 'custom', team })}
            >
                <Users className="mr-2 h-4 w-4 text-blue-500" />
                <span className="truncate flex-1 text-left">{team.name}</span>
            </Button>
        );
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col gap-4">
             {/* Header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b h-14 shrink-0">
                <Button variant="ghost" size="icon" asChild><Link to="/admin"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div className="flex-1">
                    <h2 className="text-lg font-semibold tracking-tight">組織・チーム管理</h2>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-72 border-r flex flex-col bg-muted/10">
                    <div className="flex-1 overflow-auto">
                        <div className="p-4 space-y-6">
                            {/* Section 1: Company */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-muted-foreground px-2 flex items-center gap-2">
                                    <Building className="h-4 w-4" /> 組織 (Company)
                                </h3>
                                <div className="space-y-0.5">
                                    {isCompanyLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> : 
                                     companyGroups?.map(g => renderGroupItem(g, 'company'))}
                                    {companyGroups?.length === 0 && <p className="text-xs text-muted-foreground px-4 py-2">データがありません</p>}
                                </div>
                            </div>

                            {/* Section 2: Shared Teams */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-muted-foreground px-2 flex items-center gap-2">
                                    <Shield className="h-4 w-4" /> 共有チーム (Shared)
                                </h3>
                                <div className="space-y-0.5">
                                    {isSharedLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> : 
                                     sharedTeams?.map(g => renderGroupItem(g, 'shared'))}
                                    {(!sharedTeams || sharedTeams.length === 0) && <p className="text-xs text-muted-foreground px-4 py-2">データがありません</p>}
                                </div>
                            </div>

                            {/* Section 3: Custom Teams */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Users className="h-4 w-4" /> カスタムチーム
                                    </h3>
                                    {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreateOpen(true)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    {isLocalLoading ? <div className="p-2"><Loader2 className="h-4 w-4 animate-spin" /></div> :
                                     localTeams?.map(t => renderLocalTeamItem(t))}
                                    {(!localTeams || localTeams.length === 0) && <p className="text-xs text-muted-foreground px-4 py-2">チームを作成してください</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-auto bg-background">
                    {selection ? (
                        <TeamDetailView 
                            key={selection.type === 'custom' ? selection.team.id : (selection as any).group?.id + selection.type}
                            selection={selection} 
                            isAdmin={isAdmin} 
                            onDeleteTeam={() => deleteTeamMutation.mutate(selection.type === 'custom' ? selection.team.id : '')}
                            customTeamOverride={selection.type === 'custom' ? localTeams?.find(t => t.id === selection.team.id) : undefined}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>左側のメニューからグループまたはチームを選択してください</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Team Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>新規チーム作成</DialogTitle>
                        <DialogDescription>ワークフローで使用する独自のチームを作成します</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>チーム名</Label>
                            <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="例: プロジェクトA" />
                        </div>
                        <div className="space-y-2">
                            <Label>説明</Label>
                            <Textarea value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>キャンセル</Button>
                        <Button onClick={() => createTeamMutation.mutate({ name: newTeamName, description: newTeamDesc })} disabled={!newTeamName || createTeamMutation.isPending}>作成</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// --- Detail View Component ---

// --- Detail View Component ---

const ConfirmDialog = ({ open, onOpenChange, title, description, onConfirm }: { open: boolean, onOpenChange: (open: boolean) => void, title: string, description: string, onConfirm: () => void }) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>キャンセル</Button>
                    <Button variant="default" onClick={() => { onConfirm(); onOpenChange(false); }}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

function TeamDetailView({ selection, isAdmin, onDeleteTeam, customTeamOverride }: { selection: SelectionType, isAdmin: boolean, onDeleteTeam: () => void, customTeamOverride?: LocalTeam }) {
    const queryClient = useQueryClient();
    
    // Debugging 404: Log the ID we are requesting
    if ((selection.type === 'company' || selection.type === 'shared') && (selection as any).group?.id) {
         // console.log('Requests members for group ID:', (selection as any).group.id);
    }
    const { data: kcMembers, isLoading: isKcLoading, error: kcError } = useQuery<UserSnapshot[]>({
        queryKey: ['group-members', (selection as any).group?.id],
        queryFn: () => api.get(`/users/groups/${(selection as any).group.id}/members`),
        enabled: selection.type !== 'custom' && !!(selection as any).group?.id
    });

    // Fetch Departments for linking (only for Custom Teams)
    const { data: departments } = useQuery<KeycloakGroup[]>({
        queryKey: ['departments-all'],
        queryFn: () => api.get('/users/departments'),
        enabled: selection.type === 'custom'
    });

    // Custom Team Local State Management
    const initialMembers = customTeamOverride?.members || selection.type === 'custom' ? (selection as any).team.members : [];
    const [localMembers, setLocalMembers] = useState<any[]>(initialMembers);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    
    // Sync local state when selection changes - REMOVED useEffect
    // handled by key prop on component

    const handleAddMember = (member: { memberType: 'user' | 'department', memberId: string, memberInfo?: any }) => {
        // Build a temporary member object for display
        const newMember = {
            id: `temp-${crypto.randomUUID()}`, // temporary ID
            ...member
        };
        setLocalMembers([...localMembers, newMember]);
        setHasUnsavedChanges(true);
        setAddMemberOpen(false);
        setMemberId('');
        setSearchQuery('');
    };

    const handleRemoveMember = (memberId: string) => {
        setLocalMembers(localMembers.filter(m => m.memberId !== memberId));
        setHasUnsavedChanges(true);
    };

    // Dialog States
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [confirmDeleteMember, setConfirmDeleteMember] = useState<{ open: boolean, memberId: string | null }>({ open: false, memberId: null });
    const [confirmSave, setConfirmSave] = useState(false);

    // Save Mutation (Batch Update)
    const saveMembersMutation = useMutation({
        mutationFn: (data: { teamId: string, members: any[] }) => api.put(`/teams/${data.teamId}/members`, { members: data.members }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            setHasUnsavedChanges(false);
        }
    });

    const [memberType, setMemberType] = useState<'user' | 'department'>('user');
    const [searchQuery, setSearchQuery] = useState('');
    const [memberId, setMemberId] = useState<string>(''); // Stores username or department path
    
    const { data: searchResults } = useQuery<any[]>({ 
        queryKey: ['user-search', searchQuery], 
        queryFn: () => api.get(`/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`).then((r: any) => r.data || r), 
        enabled: addMemberOpen && memberType === 'user' && searchQuery.length > 0 
    });

    // Debugging: Log members for Company view
    if (selection.type === 'company' && kcError) {
        console.error('Failed to fetch company members:', kcError);
    }

    if (selection.type === 'custom') {
        const team = customTeamOverride || selection.team;
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50">Custom Team</Badge>
                            {hasUnsavedChanges && <Badge variant="destructive" className="ml-2">未保存の変更あり</Badge>}
                        </div>
                        <h1 className="text-2xl font-bold">{team.name}</h1>
                        {team.description && <p className="text-muted-foreground mt-1">{team.description}</p>}
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2">
                             <Button onClick={() => { setMemberType('user'); setMemberId(''); setAddMemberOpen(true); }}><UserPlus className="h-4 w-4 mr-2" />メンバー追加</Button>
                             <Button onClick={() => setConfirmSave(true)} disabled={!hasUnsavedChanges || saveMembersMutation.isPending}>
                                {saveMembersMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                変更を保存
                             </Button>
                             <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={onDeleteTeam}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    )}
                </div>

                <Card>
                    <CardHeader><CardTitle>メンバー一覧 ({localMembers.length})</CardTitle></CardHeader>
                    <CardContent>
                         {localMembers.length > 0 ? (
                            <div className="grid gap-2">
                                {localMembers.map((m) => (
                                    <div key={m.memberId} className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
                                        <div className="flex items-center gap-3">
                                            {m.memberType === 'user' ? (
                                                <Avatar>
                                                    <AvatarFallback>{(m.memberInfo?.displayName || m.memberId).substring(0,2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                            ) : (
                                                <Folder className="h-8 w-8 text-muted-foreground p-1 bg-muted rounded-full" />
                                            )}
                                            <div>
                                                <p className="font-medium">{m.memberInfo?.displayName || m.memberId}</p>
                                                {m.memberInfo?.email && <p className="text-sm text-muted-foreground">{m.memberInfo.email}</p>}
                                                {m.memberType === 'department' && <p className="text-xs text-muted-foreground">部署連携</p>}
                                                <div className="text-xs text-muted-foreground">Type: {m.memberType}</div>
                                            </div>
                                            <Badge variant="secondary" className="ml-2">{m.memberType === 'user' ? 'User' : 'Dept'}</Badge>
                                        </div>
                                        {isAdmin && (
                                            <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteMember({ open: true, memberId: m.memberId })}>
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                         ) : <p className="text-muted-foreground text-center py-8">メンバーがいません</p>}
                    </CardContent>
                </Card>

                {/* Add Member Dialog (Local) */}
                 <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>メンバー追加</DialogTitle></DialogHeader>
                        
                        <div className="flex gap-2 mb-4">
                            <Button variant={memberType === 'user' ? 'default' : 'outline'} onClick={() => { setMemberType('user'); setMemberId(''); }} size="sm">ユーザー</Button>
                            <Button variant={memberType === 'department' ? 'default' : 'outline'} onClick={() => { setMemberType('department'); setMemberId(''); }} size="sm">部署 (Department)</Button>
                        </div>

                        <div className="space-y-4 py-4">
                            {memberType === 'user' ? (
                                <div className="space-y-2">
                                    <Label>ユーザー検索</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input placeholder="名前またはID..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                    </div>
                                    {searchResults && (
                                        <div className="border rounded-md max-h-48 overflow-auto mt-2">
                                            {searchResults.map((u: any) => (
                                                <div key={u.id} 
                                                    className={cn("p-2 cursor-pointer hover:bg-muted flex justify-between", memberId === u.username && "bg-muted")} 
                                                    onClick={() => setMemberId(u.username)}
                                                >
                                                    <span>{u.displayName || u.username}</span>
                                                    <span className="text-xs text-muted-foreground">@{u.username}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {memberId && <Badge>選択中: {memberId}</Badge>}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label>部署選択</Label>
                                    <div className="border rounded-md max-h-60 overflow-auto">
                                        {departments?.map((d) => (
                                            <div key={d.path} 
                                                className={cn("p-2 cursor-pointer hover:bg-muted flex items-center gap-2", memberId === (d.deptCode || d.path) && "bg-muted")}
                                                onClick={() => setMemberId(d.deptCode || d.path)}
                                                style={{ paddingLeft: `${Math.max(8, (d.path.split('/').length - 1) * 12)}px` }}
                                            >   
                                                {d.path === '/Company' ? <Building className="h-3 w-3" /> : <Folder className="h-3 w-3 text-muted-foreground" />}
                                                <span>{d.name} {d.deptCode && <span className="text-xs text-muted-foreground">({d.deptCode})</span>}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {memberId && <p className="text-xs text-muted-foreground mt-1">選択中: {memberId}</p>}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>キャンセル</Button>
                            <Button onClick={() => {
                                // Find user info for display
                                let memberInfo = {};
                                if (memberType === 'user') {
                                    const u = searchResults?.find((r: any) => r.username === memberId);
                                    if (u) memberInfo = { displayName: u.displayName || u.username, email: u.email };
                                    else memberInfo = { displayName: memberId };
                                } else {
                                     // For department, we don't have full info in local scope easily without re-finding, but we have the path/code
                                     memberInfo = { displayName: memberId };
                                }
                                handleAddMember({ memberType, memberId, memberInfo });
                            }} disabled={!memberId}>
                                追加
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Confirm Delete Member Dialog */}
                <ConfirmDialog 
                    open={confirmDeleteMember.open} 
                    onOpenChange={(o) => setConfirmDeleteMember({ open: o, memberId: null })}
                    title="メンバー削除の確認"
                    description="このメンバーをリストから削除しますか？（変更を保存するまで反映されません）"
                    onConfirm={() => {
                        if (confirmDeleteMember.memberId) handleRemoveMember(confirmDeleteMember.memberId);
                    }}
                />

                {/* Confirm Save Dialog */}
                <ConfirmDialog 
                    open={confirmSave} 
                    onOpenChange={setConfirmSave}
                    title="変更の保存"
                    description="メンバー構成の変更を保存しますか？"
                    onConfirm={() => saveMembersMutation.mutate({ teamId: team.id, members: localMembers })}
                />
            </div>
        );
    }
    
    // Keycloak View
    const group = selection.group;
    const typeLabel = selection.type === 'company' ? 'Organization Unit' : 'Shared Team';

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={selection.type === 'company' ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-purple-50 text-purple-600 border-purple-200"}>{typeLabel}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{group.path}</span>
                    </div>
                    <h1 className="text-2xl font-bold">{group.name}</h1>
                    {group.deptCode && <p className="text-muted-foreground mt-1">Code: {group.deptCode}</p>}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>メンバー一覧</CardTitle>
                    <CardDescription>Keycloakで管理されているメンバーです（読み取り専用）</CardDescription>
                </CardHeader>
                <CardContent>
                    {isKcLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> :
                     kcMembers && kcMembers.length > 0 ? (
                        <div className="grid gap-2">
                            {kcMembers.map((m) => (
                                <div key={m.username} className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                                    <div className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarFallback>{(m.firstName?.[0] || m.username[0]).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{m.lastName} {m.firstName} <span className="text-xs text-muted-foreground font-normal">@{m.username}</span></p>
                                            <p className="text-sm text-muted-foreground">{m.email}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     ) : <p className="text-muted-foreground text-center py-8">メンバーが見つかりません</p>}
                </CardContent>
            </Card>
        </div>
    );
}
