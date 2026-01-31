import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Search, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface AppSelectorProps {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}

export function AppSelector({ selectedIds, onChange }: AppSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    
    // Fetch all application definitions
    const { data: apps, isLoading } = useQuery({
        queryKey: ['application-definitions', 'all'],
        queryFn: async () => {
            const res = await api.get<{ data: any[], total: number }>('/application-definitions?limit=100');
            return res.data;
        }
    });

    const filteredApps = apps?.filter((app: any) => 
        app.name.toLowerCase().includes(search.toLowerCase()) || 
        (app.description && app.description.toLowerCase().includes(search.toLowerCase()))
    ) || [];

    const selectedAppsData = apps?.filter((app: any) => selectedIds.includes(app.id)) || [];

    const toggleApp = (appId: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedIds, appId]);
        } else {
            onChange(selectedIds.filter(id => id !== appId));
        }
    };

    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {selectedAppsData.map((app: any) => (
                    <Badge key={app.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                        {app.name}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 rounded-full hover:bg-muted-foreground/20"
                            onClick={() => toggleApp(app.id, false)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </Badge>
                ))}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <Plus className="h-3 w-3" />
                            アプリを選択
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>アプリケーションの選択</DialogTitle>
                            <DialogDescription>
                                このコネクタの使用を許可するアプリケーションを選択してください。
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="アプリ名で検索..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
                            {filteredApps.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    {(apps && apps.length > 0) ? '検索条件に一致するアプリがありません' : 'アプリケーションが見つかりません'}
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {filteredApps.map((app: any) => {
                                        const isSelected = selectedIds.includes(app.id);
                                        return (
                                            <div 
                                                key={app.id} 
                                                className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors ${isSelected ? 'bg-accent/20' : ''}`}
                                                onClick={() => toggleApp(app.id, !isSelected)}
                                            >
                                                <Checkbox 
                                                    id={`app-${app.id}`} 
                                                    checked={isSelected}
                                                    onCheckedChange={(c) => toggleApp(app.id, !!c)}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1 space-y-1">
                                                    <Label 
                                                        htmlFor={`app-${app.id}`} 
                                                        className="font-medium cursor-pointer"
                                                    >
                                                        {app.name}
                                                    </Label>
                                                    {app.description && (
                                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                                            {app.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button onClick={() => setOpen(false)}>完了</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            {selectedIds.length === 0 && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded text-xs border border-amber-200">
                     <span className="font-bold">注意:</span> アプリケーションが選択されていません。このままでは所有者以外のユーザーはこのコネクタを使用できません。
                </div>
            )}
        </div>
    );
}
