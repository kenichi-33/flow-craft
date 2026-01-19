// DynamicFormRenderer - Converted from MUI to shadcn/ui
import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'isomorphic-dompurify';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import FileUploadField from '../fields/FileUploadField';
import UserSelector from '../fields/UserSelector';
import DepartmentSelector from '../fields/DepartmentSelector';
import DataGridField, { type GridColumn } from '../fields/DataGridField';
import CurrencyInputField from '../fields/CurrencyInputField';
import CalculationField from '../fields/CalculationField';

export interface DynamicFormRendererProps {
    schema: any;
    layouts?: any;
    onSubmit?: (data: any) => void;
    renderActions?: (methods: any) => React.ReactNode;
    readOnly?: boolean;
    initialData?: any;
    defaultValues?: any;
    fieldPermissions?: Record<string, 'editable' | 'readonly' | 'hidden'>;
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
    defaultValues = {},
    fieldPermissions = {}
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
        descriptionTop: config.descriptionTop,
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
        // UI Enhancements
        autoResize: config.autoResize,
        rows: config.rows,
        height: config.height,
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

    // Theme Styles Definition
    const theme = schema?.['x-theme'] || 'standard';
    const themeStyles = {
        standard: {
            container: '',
            card: 'p-4 rounded-xl bg-muted/20 border',
            input: 'h-11 bg-background',
            textarea: 'min-h-[80px] bg-background resize-none',
            label: 'text-sm font-medium',
            button: ''
        },
        modern: {
            container: 'bg-gradient-to-br from-slate-50 to-slate-100/50 p-6 rounded-3xl',
            card: 'p-6 rounded-2xl bg-white/80 border-0 shadow-xl shadow-slate-200/50 backdrop-blur-sm',
            input: 'h-12 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-400 rounded-lg shadow-sm transition-all',
            textarea: 'min-h-[100px] bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-400 rounded-lg shadow-sm transition-all resize-none',
            label: 'text-sm font-semibold text-slate-600 mb-1.5',
            button: 'rounded-lg shadow-md hover:shadow-lg transition-all'
        },
        elegant: {
            container: 'bg-stone-50 p-8',
            card: 'p-8 rounded-none border border-stone-200 bg-white shadow-sm',
            input: 'h-10 bg-transparent border-b border-stone-300 rounded-none focus:border-stone-800 focus:ring-0 px-0 transition-colors',
            textarea: 'min-h-[80px] bg-transparent border-b border-stone-300 rounded-none focus:border-stone-800 focus:ring-0 px-0 transition-colors resize-none',
            label: 'text-xs font-bold tracking-widest text-stone-500 uppercase font-serif',
            button: 'rounded-none border-stone-800'
        },
        warm: {
            container: 'bg-orange-50/30 p-4 rounded-[2rem]',
            card: 'p-5 rounded-3xl bg-white border-2 border-orange-100 shadow-sm',
            input: 'h-11 bg-orange-50/50 border-orange-200 focus:border-orange-400 focus:ring-orange-200 rounded-2xl',
            textarea: 'min-h-[80px] bg-orange-50/50 border-orange-200 focus:border-orange-400 focus:ring-orange-200 rounded-2xl resize-none',
            label: 'text-sm font-medium text-orange-900',
            button: 'rounded-2xl'
        }
    };
    const styles = themeStyles[theme as keyof typeof themeStyles] || themeStyles.standard;

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
            // Check Field Permissions
            const permission = fieldPermissions[field.id];
            
            // 1. Hidden
            if (permission === 'hidden') return null;

            // 2. ReadOnly (Overall readOnly overrides field editable, but field readonly overrides field editable)
            // Logic: If overall is readOnly, everything is readOnly. 
            //        If field permission is 'readonly', it is readOnly.
            //        If field config has readOnly: true, it is readOnly.
            const isFieldReadOnly = readOnly || field.readOnly || permission === 'readonly';

            const layoutItem = layout.find((l: any) => l.i === field.id);
            const colSpan = Math.min(layoutItem?.w || 12, 12);
            const value = getValues(field.id);

            // Group Handling (Recursive)
            if (field.type === 'group') {
                return (
                    <div key={field.id} className={styles.card} style={{ gridColumn: `span ${colSpan}` }}>
                        {field.label && <h3 className={`text-base font-bold mb-4 ${theme === 'elegant' ? 'font-serif text-stone-800' : 'text-foreground'}`}>{field.label}</h3>}
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


            // Spacer
            if (field.type === 'spacer') {
                return <div key={field.id} style={{ height: (field.height || 20) + 'px', gridColumn: `span ${colSpan}` }} className="w-full" aria-hidden="true" />;
            }

            // Section Header
            if (field.type === 'section') {
                return (
                    <div key={field.id} className="mt-6 mb-2 space-y-2 col-span-12" style={{ gridColumn: `span 12` }}>
                        <h3 className={`text-lg font-bold flex items-center gap-2 ${theme === 'elegant' ? 'font-serif text-stone-800' : 'text-foreground'}`}>
                            {field.label}
                        </h3>
                        <Separator className={theme === 'warm' ? 'bg-orange-200' : ''} />
                    </div>
                );
            }

             // Rich Text / Description
             if (field.type === 'richText') {
                const sanitizedHtml = DOMPurify.sanitize(field.defaultValue || '');
                return (
                    <div 
                        key={field.id} 
                        className={`tiptap-content prose prose-sm max-w-none dark:prose-invert col-span-12 ${theme === 'elegant' ? 'font-serif' : ''} ${styles.label}`}
                        style={{ gridColumn: `span ${colSpan}` }}
                        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                    />
                );
            }

            return (
                <div key={field.id} className="space-y-2" style={{ gridColumn: `span ${colSpan}` }}>
                    {field.type !== 'richText' && field.type !== 'spacer' && field.type !== 'section' && field.type !== 'divider' && field.type !== 'label' && (
                        <Label className={`${styles.label} block text-${field.align || 'left'}`}>
                            {field.label}
                            {field.required && !readOnly && <span className="text-destructive ml-1">*</span>}
                        </Label>
                    )}
                    
                    {field.descriptionTop && <p className="text-xs text-muted-foreground">{field.descriptionTop}</p>}

                    {field.type === 'textarea' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted min-h-[80px] text-sm whitespace-pre-wrap">{value || '-'}</div>
                        ) : (
                            <Textarea 
                                {...register(field.id, { required: field.required })} 
                                placeholder={`${field.label}を入力...`} 
                                rows={field.rows || 3} 
                                className={`${styles.textarea} ${field.autoResize ? 'field-sizing-content' : ''}`}
                                style={field.autoResize ? { fieldSizing: 'content' } as any : undefined}
                            />
                        )
                    ) : field.type === 'select' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">
                                {field.options.find((o: any) => (typeof o === 'string' ? o : o.value) === value)?.label || value || '-'}
                            </div>
                        ) : (
                            <Controller name={field.id} control={control} rules={{ required: field.required }} render={({ field: f }) => (
                                <Select value={f.value || ''} onValueChange={f.onChange}>
                                    <SelectTrigger className={styles.input}><SelectValue placeholder="選択してください" /></SelectTrigger>
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
                        <div className={`space-y-2 ${theme !== 'elegant' ? 'p-3 bg-muted/30 rounded-lg border' : 'p-0'}`}>
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
                        <div className={`space-y-2 ${theme !== 'elegant' ? 'p-3 bg-muted/30 rounded-lg border' : 'p-0'}`}>
                             {isFieldReadOnly ? (
                                (() => {
                                    const selectedOption = field.options.find((opt: any) => (typeof opt === 'string' ? opt : opt.value) === value);
                                    return selectedOption ? (
                                        <Badge variant="outline" className="text-sm font-normal">
                                            {typeof selectedOption === 'string' ? selectedOption : selectedOption.label}
                                        </Badge>
                                    ) : <span className="text-muted-foreground text-sm">-</span>;
                                })()
                             ) : (
                                <Controller
                                    name={field.id}
                                    control={control}
                                    rules={{ required: field.required }}
                                    render={({ field: f }) => (
                                        <RadioGroup onValueChange={f.onChange} defaultValue={f.value} className="flex flex-col space-y-2">
                                            {field.options.map((opt: any, i: number) => {
                                                const val = typeof opt === 'string' ? opt : opt.value;
                                                const label = typeof opt === 'string' ? opt : opt.label;
                                                return (
                                                    <div key={i} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={val} id={`${field.id}-${i}`} />
                                                        <Label htmlFor={`${field.id}-${i}`} className="font-normal cursor-pointer">{label}</Label>
                                                    </div>
                                                );
                                            })}
                                        </RadioGroup>
                                    )}
                                />
                             )}
                        </div>
                    ) : field.type === 'date' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">{value ? new Date(value).toLocaleDateString('ja-JP') : '-'}</div>
                        ) : (
                            <Input type={field.includeTime ? 'datetime-local' : 'date'} {...register(field.id, { required: field.required })} className={styles.input} />
                        )
                    ) : field.type === 'number' ? (
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm text-right font-mono">{value ?? '-'}</div>
                        ) : (
                            <Input type="number" {...register(field.id, { required: field.required })} placeholder={`${field.label}を入力...`} className={`${styles.input} text-right font-mono`} />
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
                                            className={styles.input} 
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
                                            className={styles.input} 
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
                            <Input type="time" {...register(field.id, { required: field.required })} className={styles.input} />
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
                                className={styles.input} 
                            />
                        )
                    ) : (
                        // Default fallback
                        isFieldReadOnly ? (
                            <div className="p-3 rounded-lg bg-muted text-sm">{value || '-'}</div>
                        ) : (
                            <Input type="text" {...register(field.id, { required: field.required })} placeholder={`${field.label}を入力...`} className={styles.input} />
                        )
                    )}

                    {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
                    {errors[field.id] && <p className="text-xs text-destructive">この項目は必須です</p>}
                </div>
            );
        });
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.container}>
            <div ref={containerRef} className="space-y-6">
                <div className="grid grid-cols-12 gap-4">
                    {renderFields(undefined)}
                </div>
            </div>
            {renderActions && <div className="mt-6">{renderActions(methods)}</div>}
        </form>
    );
}
