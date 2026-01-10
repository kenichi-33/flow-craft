import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, User } from 'lucide-react';
import { api } from '@/lib/api';

// Inline debounce hook if not exists
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

export interface User {
    username: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    department?: string;
    displayName?: string;
}

interface UserSelectorProps {
    value?: string;
    displayValue?: string;
    onChange: (username: string, user?: User) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function UserSelector({ value, displayValue, onChange, disabled, placeholder }: UserSelectorProps) {
    const [inputValue, setInputValue] = useState(displayValue || value || '');
    const [results, setResults] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    
    // Update local state if prop changes
    useEffect(() => {
        if (displayValue !== undefined) {
            setInputValue(displayValue);
        } else if (value !== undefined && !displayValue) {
            setInputValue(value);
        }
    }, [value, displayValue]);

    const debouncedSearch = useDebounceValue(inputValue, 500);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!debouncedSearch || debouncedSearch.length < 2) {
                setResults([]);
                return;
            }
            // Avoid searching if the value exactly matches the prop (i.e. we just selected it)
            if (debouncedSearch === value || (displayValue && debouncedSearch === displayValue)) return;

            setIsLoading(true);
            try {
                // Assuming backend has /users/search?q=... 
                const data = await api.get<User[]>(`/users/search?q=${encodeURIComponent(debouncedSearch)}&limit=10`);
                setResults(Array.isArray(data) ? data : (data as any).data || []);
                setIsOpen(true);
            } catch (error) {
                console.error('Failed to search users', error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [debouncedSearch, value, displayValue]);

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

    const handleSelect = (user: User) => {
        const name = user.displayName || `${user.lastName || ''} ${user.firstName || ''}`.trim();
        const display = name ? `${name} (${user.username})` : user.username;
        setInputValue(display);
        onChange(user.username, user);
        setIsOpen(false);
        setResults([]);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <Input 
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        // If cleared, notify parent
                        if (e.target.value === '') onChange('', undefined);
                    }}
                    placeholder={placeholder || "ユーザー名で検索..."}
                    disabled={disabled}
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true);
                    }}
                />
                {isLoading && (
                    <div className="absolute right-2 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>
            {isOpen && results.length > 0 && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md animate-in fade-in-0 zoom-in-95">
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {results.map((user) => (
                            <li 
                                key={user.username}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground flex flex-col"
                                onClick={() => handleSelect(user)}
                            >
                                <span className="font-medium">
                                    {user.displayName || `${user.lastName || ''} ${user.firstName || ''}`.trim()} ({user.username})
                                </span>
                                {user.department && <span className="text-xs text-muted-foreground">{user.department}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
