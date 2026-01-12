import React, { useEffect } from 'react';
import { useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { Input } from '@/components/ui/input';

interface CalculationFieldProps {
    field: any;
    control: Control<any>;
    setValue: UseFormSetValue<any>;
    readOnly?: boolean;
}

export default function CalculationField({ field, control, setValue, readOnly }: CalculationFieldProps) {
    const formula = field.formula || '';
    
    // Parse formula to find dependencies (field IDs)
    const tokens = formula.split(/([+\-*/() ]+)/).filter((t: string) => t.trim() !== '');
    const dependencies = tokens.filter((t: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t));
    
    // Watch all values
    const values = useWatch({
        control,
        name: dependencies.length > 0 ? dependencies : [],
    });
    
    // Calculate value
    const calculate = () => {
        if (!formula) return '';
        
        try {
            let evalFormula = formula;
            
            for (let i = 0; i < dependencies.length; i++) {
                const dep = dependencies[i];
                const val = values[i];
                
                const numVal = parseFloat(String(val).replace(/,/g, ''));
                const safeVal = isNaN(numVal) ? 0 : numVal;
                
                const regex = new RegExp(`\\b${dep}\\b`, 'g');
                evalFormula = evalFormula.replace(regex, String(safeVal));
            }
            
            if (!/^[0-9.+\-*/() ]*$/.test(evalFormula)) {
                return 'Error';
            }
            
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const result = new Function(`return (${evalFormula})`)();
            
            if (!isFinite(result) || isNaN(result)) return '';
            return result;
        } catch (e) {
            return 'Error';
        }
    };

    const result = calculate();
    
    useEffect(() => {
        if (result !== '' && result !== 'Error') {
            setValue(field.id, result);
        }
    }, [result, field.id, setValue]);

    if (readOnly) {
         return (
            <div className="p-3 rounded-lg bg-muted text-sm text-right font-mono font-bold text-muted-foreground">
                {result !== '' && result !== 'Error' ? new Intl.NumberFormat('ja-JP').format(Number(result)) : '-'}
            </div>
        );
    }

    return (
        <div className="relative">
            <span className="absolute left-3 top-2.5 text-muted-foreground w-4 text-center">=</span>
            <Input 
                type="text" 
                value={result !== '' && result !== 'Error' ? new Intl.NumberFormat('ja-JP').format(Number(result)) : result}
                readOnly
                className="h-11 bg-muted pl-8 text-right font-mono font-bold cursor-not-allowed text-muted-foreground" 
            />
        </div>
    );
}
