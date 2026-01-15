import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Users } from 'lucide-react';
import { api } from '@/lib/api';

// Inline debounce hook
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export interface Group {
    id: string;
    name: string;
    path: string;
    deptCode?: string;
}

interface GroupSelectorProps {
    value?: string; // deptCode or path
    displayValue?: string;
    onChange: (deptCode: string, group?: Group) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function GroupSelector({ value, displayValue, onChange, disabled, placeholder }: GroupSelectorProps) {
    const [inputValue, setInputValue] = useState(displayValue || '');
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    
    // Fetch all groups on first focus (cached)
    const fetchGroups = async () => {
        if (allGroups.length > 0) return; // Already loaded
        setIsLoading(true);
        try {
            const data = await api.get<Group[]>('/users/departments');
            const groups = Array.isArray(data) ? data : (data as any) || [];
            setAllGroups(groups);
            setFilteredGroups(groups);
        } catch (error) {
            console.error('Failed to fetch groups', error);
            setAllGroups([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Update local state if prop changes
    useEffect(() => {
        if (displayValue !== undefined) {
            setInputValue(displayValue);
        }
    }, [displayValue]);

    const debouncedSearch = useDebounceValue(inputValue, 300);

    // Filter groups based on search
    useEffect(() => {
        if (!debouncedSearch) {
            setFilteredGroups(allGroups);
            return;
        }
        const lower = debouncedSearch.toLowerCase();
        const filtered = allGroups.filter(g => 
            g.name.toLowerCase().includes(lower) ||
            (g.deptCode && g.deptCode.toLowerCase().includes(lower)) ||
            g.path.toLowerCase().includes(lower)
        );
        setFilteredGroups(filtered);
    }, [debouncedSearch, allGroups]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (group: Group) => {
        setInputValue(group.name);
        onChange(group.deptCode || group.path, group);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <Users className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        if (e.target.value === '') onChange('', undefined);
                    }}
                    placeholder={placeholder || "部署名で検索..."}
                    disabled={disabled}
                    className="pl-8"
                    onFocus={() => {
                        fetchGroups();
                        setIsOpen(true);
                    }}
                />
                {isLoading && (
                    <div className="absolute right-2 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md animate-in fade-in-0 zoom-in-95">
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {filteredGroups.length === 0 && !isLoading && (
                            <li className="px-3 py-2 text-sm text-muted-foreground">
                                該当するグループがありません
                            </li>
                        )}
                        {filteredGroups.map((group) => (
                            <li 
                                key={group.id || group.path}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground flex flex-col ${value === group.deptCode || value === group.path ? 'bg-accent/50' : ''}`}
                                onClick={() => handleSelect(group)}
                            >
                                <span className="font-medium flex items-center gap-2">
                                    {group.name}
                                    {group.deptCode && (
                                        <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                                            {group.deptCode}
                                        </span>
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground">{group.path}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
