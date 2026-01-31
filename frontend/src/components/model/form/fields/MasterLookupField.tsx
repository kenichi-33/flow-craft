import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { api } from '@/lib/api';

// Manual debounce hook implementation if not available
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

interface MasterLookupFieldProps {
    field: any;
    value: any;
    onChange: (value: any) => void;
    setValue: (fieldId: string, value: any) => void; // Hook form setValue
    readOnly?: boolean;
    className?: string;
}

export default function MasterLookupField({
    field,
    value,
    onChange,
    setValue,
    readOnly,
    className
}: MasterLookupFieldProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const debouncedQuery = useDebounceValue(query, 500);

    const connectorId = field.connectorId;

    // Debug log
    // console.log('MasterLookupField Render:', { connectorId, open, query, debouncedQuery });

    // Fetch data when query changes
    useEffect(() => {
        if (!connectorId || !open) {
            // console.log('Skipping fetch:', { connectorId, open });
            return;
        }

        // Min length check
        if (debouncedQuery.length < 2) {
            setItems([]);
            return;
        }

        console.log('Fetching master data:', { connectorId, debouncedQuery });

        let active = true;
        const fetchData = async () => {
            setLoading(true);
            try {
                // Determine query param. API defaults to 'q', but connector config defines param name.
                // The proxy endpoint accepts 'q' and passes it to the configured param name.
                const res = await api.get<any[]>(`/master-connectors/${connectorId}/proxy?q=${encodeURIComponent(debouncedQuery)}`);
                if (active) {
                    setItems(res || []);
                }
            } catch (error) {
                console.error("Failed to fetch master data", error);
                if (active) setItems([]);
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchData();

        return () => {
            active = false;
        };
    }, [debouncedQuery, connectorId, open]);

    // Initial fetch to show label if value is set but label is missing?
    // Actually, we store ID as value. To show label, we might need to fetch item by ID if it's not in the list.
    // For now, assuming the list populates correctly or we display value if label missing.
    // A better approach for initial load is to have a way to fetch 'single item' by ID, but proxy api usually searches.
    // If value exists, we can try to search for it once to get the label.
    

    // Find selected item label
    const selectedItem = items.find(item => item.value === value);

    const handleSelect = (item: any) => {
        onChange(item.value);
        setOpen(false);

        // Process bindings
        if (field.binding) {
            Object.entries(field.binding).forEach(([metaKey, targetFieldId]) => {
                const targetValue = item.metadata?.[metaKey];
                if (targetValue !== undefined && typeof targetFieldId === 'string') {
                    // console.log(`Binding: ${metaKey} -> ${targetFieldId} = ${targetValue}`);
                    setValue(targetFieldId, targetValue);
                }
            });
        }
    };

    if (readOnly) {
        return (
            <div className={cn("p-3 rounded-lg bg-muted text-sm", className)}>
                {selectedItem ? selectedItem.label : (value || '-')}
            </div>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
                >
                    {selectedItem ? selectedItem.label : (value ? String(value) : "選択してください")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}> {/* We do server-side filtering */}
                    <CommandInput 
                        placeholder="検索..." 
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && (
                            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                検索中...
                            </div>
                        )}
                        {!loading && items.length === 0 && (
                            <CommandEmpty>
                                {query.length < 2 ? '2文字以上入力してください' : '見つかりません'}
                            </CommandEmpty>
                        )}
                        {!loading && items.map((item) => (
                            <CommandItem
                                key={item.value}
                                value={item.value} // Command uses value for selection
                                onSelect={() => handleSelect(item)}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === item.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span>{item.label}</span>
                                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                                         <span className="text-[10px] text-muted-foreground">
                                             {Object.values(item.metadata).slice(0, 2).join(', ')}
                                         </span>
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
