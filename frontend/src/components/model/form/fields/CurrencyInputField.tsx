import React, { useState, useEffect } from 'react';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';

interface CurrencyInputFieldProps {
    field: any;
    control: any;
    readOnly: boolean;
}

export default function CurrencyInputField({ field, control, readOnly }: CurrencyInputFieldProps) {
    if (readOnly) {
         return null; 
    }

    return (
        <Controller
            name={field.id}
            control={control}
            rules={{ required: field.required }}
            render={({ field: f }) => <CurrencyInputInternal formField={f} />}
        />
    );
}

function CurrencyInputInternal({ formField: f }: { formField: any }) {
    // Internal state for display
    const [displayVal, setDisplayVal] = useState('');

    // Sync with external value changes (e.g. loaded data)
    useEffect(() => {
        const num = Number(f.value);
        if (!isNaN(num) && f.value !== '' && f.value !== undefined && f.value !== null) {
            setDisplayVal(new Intl.NumberFormat('ja-JP').format(num));
        } else {
            setDisplayVal('');
        }
    }, [f.value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/,/g, '');
        
        // Allow empty or number
        if (raw === '' || /^-?\d*$/.test(raw)) {
            setDisplayVal(e.target.value); 
            const num = Number(raw);
            if (!isNaN(num)) {
                setDisplayVal(raw); // Show raw while typing
                f.onChange(raw === '' ? null : num);
            }
        }
    };

    const handleBlur = () => {
        const raw = displayVal.replace(/,/g, '');
        const num = Number(raw);
        if (!isNaN(num) && raw !== '') {
            setDisplayVal(new Intl.NumberFormat('ja-JP').format(num));
        }
        f.onBlur();
    };

    const handleFocus = () => {
        const raw = displayVal.replace(/,/g, '');
        setDisplayVal(raw);
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground w-4 text-center">¥</span>
            <Input 
                type="text" 
                value={displayVal}
                onChange={handleChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                className="h-11 bg-background pl-8 text-right font-mono" 
                placeholder="0"
            />
        </div>
    );
}
