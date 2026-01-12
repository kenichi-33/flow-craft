// DynamicFormRenderer - Converted from MUI to shadcn/ui
import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import FileUploadField from './FileUploadField';
import UserSelector from './UserSelector';
import DepartmentSelector from './DepartmentSelector';
import DataGridField, { type GridColumn } from './DataGridField';
import CurrencyInputField from './CurrencyInputField';
import CalculationField from './CalculationField';

export interface DynamicFormRendererProps {
    schema: any;
    layouts?: any;
    onSubmit?: (data: any) => void;
    renderActions?: (methods: any) => React.ReactNode;
    readOnly?: boolean;
    initialData?: any;
    defaultValues?: any;
}

// Width hook for responsive layout
const useWidth = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(1200);
    useEffect(() => {
        if (!ref.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) setWidth(entry.contentRect.width);
        });
        resizeObserver.observe(ref.current);
        setWidth(ref.current.offsetWidth);
        return () => resizeObserver.disconnect();
    }, []);
    return { ref, width };
};

export default function DynamicFormRenderer({ 
    schema, 
    layouts, 
    onSubmit, 
    renderActions, 
    readOnly = false, 
    initialData = {},
    defaultValues = {} 
}: DynamicFormRendererProps) {
    // 1. Parse fields first (safe even if schema is null)
    const properties = schema?.properties || {};
    const fields = Object.entries(properties).map(([id, config]: [string, any]) => ({
        id,
        type: config.type || config['x-type'] || 'text',
        label: config.title || config.label || id,
        options: config.enum || config.options || [],
        required: (schema?.required || []).includes(id) || config.required,
        readOnly: config.readOnly,
        description: config.description,
        includeTime: config.includeTime,
        align: config.align || 'left',
        defaultValue: config.default,
        parent: config['x-parent'], // Support hierarchy
        // File-specific properties
        acceptedTypes: config.acceptedTypes,
        maxSize: config.maxSize,
        multiple: config.multiple,
        maxFiles: config.maxFiles,
        // Data Grid specific properties
        columns: config.items?.properties ? Object.entries(config.items.properties).map(([key, prop]: [string, any]) => ({
            id: key,
            key: key,
            label: prop.title || prop.label || key,
            type: prop.type,
            options: prop.enum || prop.options,
        })) : undefined,
        // Calculation
        formula: config.formula,
        pattern: config.pattern,
    }));

    // 2. Compute default values
    const computedDefaults = { ...initialData, ...defaultValues };
    fields.forEach(f => {
        if (f.defaultValue !== undefined && computedDefaults[f.id] === undefined) {
            computedDefaults[f.id] = f.defaultValue;
        }
    });

    const methods = useForm({ defaultValues: computedDefaults });
    const { register, handleSubmit, formState: { errors }, control, getValues, setValue } = methods;
    const { ref: containerRef } = useWidth();

    // Handle missing or invalid schema gracefully
    if (!schema) {
        return (
            <Card className="border-0 shadow-inner bg-muted/30">
                <CardContent className="py-8 text-center text-muted-foreground">
                    フォームスキーマがありません
                </CardContent>
            </Card>
        );
    }

    // Get layout from props or schema, ensure it's an array
    const schemaLayout = schema['x-layout'];
    const propsLayout = layouts?.lg || (Array.isArray(layouts) ? layouts : layouts?.[Object.keys(layouts || {})[0]]);
    
    // Determine effective layout - must be an array
    let layout: any[];
    if (Array.isArray(propsLayout)) {
        layout = propsLayout;
    } else if (Array.isArray(schemaLayout)) {
        layout = schemaLayout;
    } else {
        // Generate default layout
        layout = fields.map((f, i) => ({ i: f.id, x: 0, y: i * 2, w: 12, h: 2 }));
    }

    // Sort fields by layout position
    const sortedFields = [...fields].sort((a, b) => {
        const la = layout.find((l: any) => l.i === a.id) || { x: 0, y: 0 };
        const lb = layout.find((l: any) => l.i === b.id) || { x: 0, y: 0 };
        return la.y === lb.y ? la.x - lb.x : la.y - lb.y;
    });

    const handleFormSubmit = (data: any) => onSubmit?.(data);

    // Recursive renderer
    const renderFields = (parentId?: string) => {
        const currentFields = sortedFields.filter(f => f.parent === parentId);
        
        return currentFields.map(field => {
            const isFieldReadOnly = readOnly || field.readOnly;
            const layoutItem = layout.find((l: any) => l.i === field.id);
            const colSpan = Math.min(layoutItem?.w || 12, 12);
            const value = getValues(field.id);

            // Group Handling (Recursive)
            if (field.type === 'group') {
                return (
                    <div key={field.id} className="p-4 rounded-xl bg-muted/20 border" style={{ gridColumn: `span ${colSpan}` }}>
                        {field.label && <h3 className="text-base font-bold mb-4 text-foreground">{field.label}</h3>}
                        <div className="grid grid-cols-12 gap-4">
                            {renderFields(field.id)}
                        </div>
                    </div>
                );
            }

            // Divider
            if (field.type === 'divider') {
                return <Separator key={field.id} className="my-4 col-span-12" style={{ gridColumn: `span 12` }} />;
            }

            // Label/Heading
            if (field.type === 'label') {
                return (
                    <div key={field.id} className={`col-span-12 py-2 text-${field.align || 'left'}`} style={{ gridColumn: `span 12` }}>
                        <h3 className="text-lg font-bold text-foreground">{field.label}</h3>
                    </div>
                );
            }

            return (
                <div key={field.id} className="space-y-2" style={{ gridColumn: `span ${colSpan}` }}>
                    <Label className={`text-sm font-medium block text-${field.align || 'left'}`}>
                        {field.label}
                        {field.required && !readOnly && <span className="text-destructive ml-1">*</span>}
                    </Label>

                    {field.type === 'textarea' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted min-h-[80px] text-sm whitespace-pre-wrap">{value || '-'}</div>
                        ) : (
                            <Textarea {...register(field.id, { required: field.required })} placeholder={`${field.label}を入力...`} rows={4} className="resize-none" />
                        )
                    ) : field.type === 'select' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">
                                {field.options.find((o: any) => (typeof o === 'string' ? o : o.value) === value)?.label || value || '-'}
                            </div>
                        ) : (
                            <Controller name={field.id} control={control} rules={{ required: field.required }} render={({ field: f }) => (
                                <Select value={f.value || ''} onValueChange={f.onChange}>
                                    <SelectTrigger className="h-11 bg-background"><SelectValue placeholder="選択してください" /></SelectTrigger>
                                    <SelectContent>
                                        {field.options.map((opt: any) => {
                                            const val = typeof opt === 'string' ? opt : opt.value;
                                            const label = typeof opt === 'string' ? opt : opt.label;
                                            return <SelectItem key={val} value={val}>{label}</SelectItem>;
                                        })}
                                    </SelectContent>
                                </Select>
                            )} />
                        )
                    ) : field.type === 'checkbox' ? (
                        <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                            {field.options.map((opt: any, i: number) => {
                                const val = typeof opt === 'string' ? opt : opt.value;
                                const label = typeof opt === 'string' ? opt : opt.label;
                                const checked = Array.isArray(value) ? value.includes(val) : false;
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        {isFieldReadOnly ? (
                                            <Badge variant={checked ? 'default' : 'outline'}>{label}</Badge>
                                        ) : (
                                            <Controller name={field.id} control={control} render={({ field: f }) => (
                                                <>
                                                    <Checkbox id={`${field.id}-${i}`} checked={Array.isArray(f.value) && f.value.includes(val)} onCheckedChange={(c) => {
                                                        const arr = Array.isArray(f.value) ? [...f.value] : [];
                                                        c ? arr.push(val) : arr.splice(arr.indexOf(val), 1);
                                                        f.onChange(arr);
                                                    }} />
                                                    <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer font-normal">{label}</Label>
                                                </>
                                            )} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : field.type === 'radio' ? (
                        <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                            {field.options.map((opt: any, i: number) => {
                                const val = typeof opt === 'string' ? opt : opt.value;
                                const label = typeof opt === 'string' ? opt : opt.label;
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        {isFieldReadOnly ? (
                                            value === val && <Badge>{label}</Badge>
                                        ) : (
                                            <Controller name={field.id} control={control} rules={{ required: field.required }} render={({ field: f }) => (
                                                <>
                                                    <input type="radio" id={`${field.id}-${i}`} value={val} checked={f.value === val} onChange={() => f.onChange(val)} className="h-4 w-4 text-primary" />
                                                    <Label htmlFor={`${field.id}-${i}`} className="cursor-pointer font-normal">{label}</Label>
                                                </>
                                            )} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : field.type === 'date' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">{value ? new Date(value).toLocaleDateString('ja-JP') : '-'}</div>
                        ) : (
                            <Input type={field.includeTime ? 'datetime-local' : 'date'} {...register(field.id, { required: field.required })} className="h-11 bg-background" />
                        )
                    ) : field.type === 'number' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm text-right font-mono">{value ?? '-'}</div>
                        ) : (
                            <Input type="number" {...register(field.id, { required: field.required })} placeholder={`${field.label}を入力...`} className="h-11 bg-background text-right font-mono" />
                        )
                    ) : field.type === 'currency' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm text-right font-mono">
                                {value ? `¥${new Intl.NumberFormat('ja-JP').format(Number(value))}` : '-'}
                            </div>
                        ) : (
                            <CurrencyInputField
                                field={field}
                                control={control}
                                readOnly={false}
                            />
                        )
                    ) : field.type === 'calculation' ? (
                        <CalculationField
                            field={field}
                            control={control}
                            setValue={setValue}
                            readOnly={isFieldReadOnly}
                        />
                    ) : field.type === 'dateRange' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm flex items-center gap-2">
                                 <span>{value?.start ? new Date(value.start).toLocaleDateString('ja-JP') : '-'}</span>
                                 <span className="text-muted-foreground">～</span>
                                 <span>{value?.end ? new Date(value.end).toLocaleDateString('ja-JP') : '-'}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Controller
                                    name={`${field.id}.start`}
                                    control={control}
                                    rules={{ required: field.required }}
                                    render={({ field: f }) => (
                                        <Input 
                                            type="date" 
                                            value={f.value || ''} 
                                            onChange={f.onChange} 
                                            className="h-11 bg-background" 
                                            placeholder="開始日"
                                        />
                                    )}
                                />
                                <span className="text-muted-foreground">～</span>
                                <Controller
                                    name={`${field.id}.end`}
                                    control={control}
                                    rules={{ required: field.required }}
                                    render={({ field: f }) => (
                                        <Input 
                                            type="date" 
                                            value={f.value || ''} 
                                            onChange={f.onChange} 
                                            className="h-11 bg-background" 
                                            placeholder="終了日"
                                        />
                                    )}
                                />
                            </div>
                        )
                    ) : field.type === 'time' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">{value || '-'}</div>
                        ) : (
                            <Input type="time" {...register(field.id, { required: field.required })} className="h-11 bg-background" />
                        )
                    ) : field.type === 'file' ? (
                        <FileUploadField
                            fieldId={field.id}
                            control={control}
                            readOnly={isFieldReadOnly}
                            required={field.required}
                            acceptedTypes={field.acceptedTypes}
                            maxSize={field.maxSize}
                            multiple={field.multiple}
                            maxFiles={field.maxFiles}
                            value={value}
                        />
                    ) : field.type === 'user-select' ? (
                        <Controller
                            name={field.id}
                            control={control}
                            rules={{ required: field.required }}
                            render={({ field: f }) => (
                                <UserSelector
                                    fieldId={field.id}
                                    value={f.value}
                                    onChange={f.onChange}
                                    readOnly={isFieldReadOnly}
                                    placeholder={`${field.label}を選択...`}
                                    multiple={field.multiple}
                                />
                            )}
                        />
                    ) : field.type === 'array' ? (
                        <Controller
                            name={field.id}
                            control={control}
                            rules={{ required: field.required }}
                            defaultValue={[]}
                            render={({ field: f }) => (
                                <DataGridField
                                    fieldId={field.id}
                                    columns={(field.columns || []) as GridColumn[]}
                                    value={f.value}
                                    onChange={f.onChange}
                                    readOnly={isFieldReadOnly}
                                />
                            )}
                        />
                    ) : field.type === 'switch' ? (
                        isFieldReadOnly ? (
                            <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/30 border">
                                <Switch checked={!!value} disabled />
                                <Label className="text-sm font-normal text-muted-foreground">{value ? '有効' : '無効'}</Label>
                            </div>
                        ) : (
                            <Controller name={field.id} control={control} render={({ field: f }) => (
                                <div className="flex items-center space-x-2">
                                    <Switch checked={f.value} onCheckedChange={f.onChange} />
                                    <Label className="text-sm font-normal cursor-pointer" onClick={() => f.onChange(!f.value)}>有効にする</Label>
                                </div>
                            )} />
                        )
                    ) : field.type === 'department' ? (
                        <Controller
                            name={field.id}
                            control={control}
                            rules={{ required: field.required }}
                            render={({ field: f }) => (
                                <DepartmentSelector
                                    value={f.value}
                                    onChange={f.onChange}
                                    readOnly={isFieldReadOnly}
                                    multiple={field.multiple}
                                    placeholder={`${field.label}を選択...`}
                                />
                            )}
                        />
                    ) : ['text', 'email', 'tel', 'url'].includes(field.type) ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">{value || '-'}</div>
                        ) : (
                             <Input 
                                type={field.type === 'text' ? 'text' : field.type} 
                                {...register(field.id, { 
                                    required: field.required,
                                    pattern: field.pattern ? new RegExp(field.pattern) : (
                                        field.type === 'email' ? /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i : 
                                        field.type === 'url' ? /^(http|https):\/\/[^ "]+$/ : undefined
                                    )
                                })} 
                                placeholder={`${field.label}を入力...`} 
                                className="h-11 bg-background" 
                            />
                        )
                    ) : (
                        // Default fallback
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">{value || '-'}</div>
                        ) : (
                            <Input type="text" {...register(field.id, { required: field.required })} placeholder={`${field.label}を入力...`} className="h-11 bg-background" />
                        )
                    )}

                    {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                    {errors[field.id] && <p className="text-xs text-destructive">この項目は必須です</p>}
                </div>
            );
        });
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div ref={containerRef} className="space-y-6">
                <div className="grid grid-cols-12 gap-4">
                    {renderFields(undefined)}
                </div>
            </div>
            {renderActions && <div className="mt-6">{renderActions(methods)}</div>}
        </form>
    );
}
