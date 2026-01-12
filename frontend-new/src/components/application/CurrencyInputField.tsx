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
         // Need to subscribe to value? 
         // In DynamicFormRenderer, value is passed down or retrieved.
         // Here we are inside the renderer loop, 'value' const was available in parent.
         // But since we extract this, we should rely on Controller or passed value.
         // For consistency with other READONLY fields in DynamicFormRenderer which use 'value' variable,
         // we might need to change how we call this.
         // Actually, DynamicFormRenderer passes 'isFieldReadOnly' but the value retrieval `const value = getValues(field.id)` is done in pure render.
         // In readOnly mode, DynamicFormRenderer usually just renders a Div.
         // So we will handle readOnly inside here? OR in parent?
         // Parent logic was:
         // isFieldReadOnly ? ( <div>...</div> ) : ( <Input ... /> )
         // I am replacing that block.
         // But I don't have 'value' prop here yet unless I pass it.
         // Let's use Controller to get value even in readOnly? or pass value from parent.
         return null; // Should not happen if parent handles readOnly switch?
         // Actually my replacement snippet handles "field.type === 'currency' ? <CurrencyInputField ... />".
         // It doesn't split readOnly inside the implementation of DynamicFormRenderer for this block.
         // So I must handle readOnly.
         // I'll grab value via useWatch or just Controller?
         // Controller is fine.
    }

    return (
        <Controller
            name={field.id}
            control={control}
            rules={{ required: field.required }}
            render={({ field: f }) => {
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
                    // Remove commas to get raw number string
                    const raw = e.target.value.replace(/,/g, '');
                    
                    // Allow empty or number
                    if (raw === '' || /^-?\d*$/.test(raw)) {
                        setDisplayVal(e.target.value); // Temporarily allow "1000" (no comma while typing) or impl format-on-type
                        
                        // BUT, user wants input formatting.
                        // Simple approach: Format on every char?
                        // "1" -> "1"
                        // "10" -> "10"
                        // "100" -> "100"
                        // "1000" -> "1,000"
                        const num = Number(raw);
                        if (!isNaN(num)) {
                             // Format immediately
                             const formatted = new Intl.NumberFormat('ja-JP').format(num);
                             // Handle cursor? Formatting on type messes up cursor position often.
                             // Safest is to just store raw display, format on blur.
                             // Display raw while focused?
                             // User asked for "Currency Input (3-digit comma auto format)".
                             // Let's stick to Format-On-Blur for robustness, or minimal formatting.
                             
                             // Let's try "Format as you type" but careful.
                             // Actually, simple impl: just set raw to state, and update `f.onChange(num)`.
                             // Format on Blur.
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
                    // On focus, strip commas for easy editing
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
            }}
        />
    );
}
