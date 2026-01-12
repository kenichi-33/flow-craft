import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
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
import { api } from '@/lib/api';

interface Department {
    id: string;
    name: string;
    path: string;
    deptCode?: string;
}

interface DepartmentSelectorProps {
    value?: string | string[];
    onChange: (value: string | string[]) => void;
    readOnly?: boolean;
    multiple?: boolean;
    placeholder?: string;
    fieldId?: string;
}

export default function DepartmentSelector({
    value,
    onChange,
    readOnly = false,
    multiple = false,
    placeholder = '部署を選択...',
}: DepartmentSelectorProps) {
    const [open, setOpen] = useState(false);
    
    // Fetch departments
    const { data: departments = [], isLoading } = useQuery({
        queryKey: ['departments'],
        queryFn: async () => {
             const res = await api.get<Department[]>('/users/departments');
             return res;
        },
        staleTime: 1000 * 60 * 30, // 30 mins
    });

    const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

    const handleSelect = (dept: Department) => {
        // We use deptCode if available, otherwise path or id?
        // Usually system expects 'group:deptCode' or similar for assignment, 
        // but for form data, just the code is fine.
        // Let's assume we store the 'deptCode' if exists, or 'path'.
        const val = dept.deptCode || dept.path;
        
        if (multiple) {
            const newValues = selectedValues.includes(val)
                ? selectedValues.filter(v => v !== val)
                : [...selectedValues, val];
            onChange(newValues);
        } else {
            onChange(val);
            setOpen(false);
        }
    };

    const getDisplayValue = () => {
        if (selectedValues.length === 0) return placeholder;
        
        const names = selectedValues.map(val => {
            const dept = departments.find(d => d.deptCode === val || d.path === val || d.id === val);
            return dept ? dept.name : val;
        });

        if (multiple) {
            return `${names.length}件選択中: ${names.join(', ')}`;
        }
        return names[0];
    };

    if (readOnly) {
         return (
            <div className="p-3 rounded-lg bg-muted text-sm min-h-[44px] flex items-center">
                 <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                {selectedValues.length > 0 ? getDisplayValue() : '-'}
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
                    className="w-full justify-between font-normal h-11"
                    disabled={isLoading}
                >
                    <span className="flex items-center truncate">
                        <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        {selectedValues.length > 0 ? getDisplayValue() : <span className="text-muted-foreground">{placeholder}</span>}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                    <CommandInput placeholder="部署を検索..." />
                    <CommandList>
                        <CommandEmpty>部署が見つかりません</CommandEmpty>
                        <CommandGroup>
                            {departments.map((dept) => {
                                const val = dept.deptCode || dept.path;
                                const isSelected = selectedValues.includes(val);
                                return (
                                    <CommandItem
                                        key={dept.id}
                                        value={dept.name}
                                        onSelect={() => handleSelect(dept)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                isSelected ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{dept.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{dept.deptCode || dept.path}</span>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
