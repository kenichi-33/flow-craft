import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface UserInfo {
    id: string;
    username: string;
    displayName: string;
    email?: string;
}

interface UserSelectorProps {
    value?: string | string[];
    onChange: (value: string | string[] | null) => void;
    multiple?: boolean;
    readOnly?: boolean;
    placeholder?: string;
    fieldId?: string; // Reserved for future use
}

export default function UserSelector({
    value,
    onChange,
    multiple = false,
    readOnly = false,
    placeholder = 'ユーザーを選択...',
    // fieldId // Unused
}: UserSelectorProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserInfo[]>([]);
    const [loading, setLoading] = useState(false);

    // Initial load of selected users
    useEffect(() => {
        const fetchInitial = async () => {
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            if (ids.length === 0) {
                setSelectedUsers([]);
                return;
            }

            // If we already have the correct users loaded, skip (simple check)
            const currentIds = selectedUsers.map(u => u.id);
            if (ids.every(id => currentIds.includes(id)) && currentIds.length === ids.length) return;

            // Fetch details for these IDs
            // Since we don't have a bulk get endpoint by ID yet, we might rely on resolve or individual fetches
            // For now, let's try to fetch via search with exact match or assumes the UI will load options lazily.
            // Actually, we need a way to resolve IDs to Names.
            // Let's us lookup or a specific resolve endpoint.
            // For this version, we will try to resolve using the resolve-display endpoint or similar logic if available,
            // or just fetch all users if small count? No, scalable way is needed.
            
            // Workaround: We will use the search endpoint to find these users if they are not loaded.
            // Ideally backend should provide a /users/ids endpoint.
            // For now, let's assume we can fetch them one by one or via a special search query.
            // Let's implement a bulk resolve on backend later. For now, we iterate.
            
            try {
                const res = await api.post<UserInfo[]>('/users/resolve', { ids });
                const resolvedUsers = res || [];
                
                const finalUsers: UserInfo[] = [];
                for (const id of ids) {
                    const found = resolvedUsers.find(u => u.id === id);
                    if (found) {
                        finalUsers.push(found);
                    } else {
                        // Fallback display
                        finalUsers.push({ id, username: id, displayName: id });
                    }
                }
                setSelectedUsers(finalUsers);
            } catch (e) {
                console.error('Failed to resolve users:', e);
                // Fallback
                setSelectedUsers(ids.map(id => ({ id, username: id, displayName: id })));
            }
        };

        fetchInitial();
    }, [value]);

    // Search users
    useEffect(() => {
        if (!open) return;

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.get<{ data: UserInfo[] }>(`/users/search?q=${query}&limit=20`);
                setUsers(res.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, open]);

    const handleSelect = (user: UserInfo) => {
        let newSelected: UserInfo[];
        
        if (multiple) {
            const exists = selectedUsers.find(u => u.id === user.id);
            if (exists) {
                newSelected = selectedUsers.filter(u => u.id !== user.id);
            } else {
                newSelected = [...selectedUsers, user];
            }
        } else {
            newSelected = [user];
            setOpen(false);
        }

        setSelectedUsers(newSelected);
        
        const newValue = multiple ? newSelected.map(u => u.id) : newSelected.length > 0 ? newSelected[0].id : null;
        onChange(newValue);
    };

    const handleRemove = (userId: string) => {
        const newSelected = selectedUsers.filter(u => u.id !== userId);
        setSelectedUsers(newSelected);
        const newValue = multiple ? newSelected.map(u => u.id) : null;
        onChange(newValue);
    };

    if (readOnly) {
        if (selectedUsers.length === 0) return <div className="text-sm text-muted-foreground">-</div>;
        return (
            <div className="flex flex-wrap gap-1">
                {selectedUsers.map(user => (
                    <div key={user.id} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-sm">
                        <User className="h-3 w-3 opacity-50" />
                        <span>{user.displayName || user.username}</span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Selected Items for Multiple Mode (Outside Popover for clarity) */}
            {multiple && selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedUsers.map(user => (
                        <Badge key={user.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                            <span className="font-normal">{user.displayName || user.username}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                                onClick={() => handleRemove(user.id)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "w-full justify-between font-normal",
                            !value && "text-muted-foreground"
                        )}
                    >
                        {!multiple && selectedUsers.length > 0 
                            ? (selectedUsers[0].displayName || selectedUsers[0].username)
                            : placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput 
                            placeholder="名前またはメールで検索..." 
                            value={query}
                            onValueChange={setQuery}
                        />
                        <CommandList>
                            <CommandEmpty>{loading ? '検索中...' : 'ユーザーが見つかりません'}</CommandEmpty>
                            <CommandGroup heading="ユーザー">
                                {users.map((user) => {
                                    const isSelected = selectedUsers.some(u => u.id === user.id);
                                    return (
                                        <CommandItem
                                            key={user.id}
                                            value={user.id}
                                            onSelect={() => handleSelect(user)}
                                        >
                                            <div className="flex items-center gap-2 w-full">
                                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
                                                    <User className="h-3 w-3" />
                                                </div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="truncate text-sm font-medium">{user.displayName}</span>
                                                    <span className="truncate text-xs text-muted-foreground">{user.email || user.username}</span>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 text-primary" />}
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
