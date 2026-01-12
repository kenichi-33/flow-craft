import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    AlignLeft, AlignCenter, AlignRight, Trash2
} from 'lucide-react';
import type { FormField } from './types';

export default function FormEditorProperties({ 
    field, 
    onUpdate, 
    readOnly 
}: { 
    field: FormField | null; 
    onUpdate: (id: string, updates: Partial<FormField>) => void; 
    readOnly?: boolean 
}) {
    if (!field) return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">フィールドを選択してください</div>;

    return (
        <div className="p-4 space-y-5">
            <h3 className="font-semibold text-sm border-b pb-2">プロパティ {readOnly && '(読取専用)'}</h3>
            


            <div className="space-y-1.5">
                <Label className="text-xs">ラベル</Label>
                <Input value={field.label} onChange={(e) => onUpdate(field.id, { label: e.target.value })} disabled={readOnly} />
            </div>

             <div className="space-y-1.5">
                <Label className="text-xs">フィールドID</Label>
                <Input 
                    value={field.id} 
                    onChange={(e) => onUpdate(field.id, { id: e.target.value })} 
                    disabled={readOnly} 
                    className="font-mono text-xs"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs">説明・ヘルプテキスト</Label>
                <Input value={field.description || ''} onChange={(e) => onUpdate(field.id, { description: e.target.value })} disabled={readOnly} />
            </div>

            {['text', 'tel', 'email', 'url'].includes(field.type) && (
                <div className="space-y-1.5 pt-2 border-t">
                     <Label className="text-xs">入力規則 (正規表現)</Label>
                     <Input 
                        value={field.pattern || ''} 
                        onChange={(e) => onUpdate(field.id, { pattern: e.target.value })} 
                        placeholder={field.type === 'tel' ? '^0[0-9-]{9,12}$' : '^[a-zA-Z0-9]+$'}
                        disabled={readOnly} 
                        className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">空欄の場合はデフォルトのチェックが適用されます</p>
                </div>
            )}
            
            {/* Alignment */}
             <div className="space-y-1.5">
                <Label className="text-xs">配置</Label>
                <div className="flex items-center gap-1 border rounded-md p-1 w-fit bg-muted/20">
                    <Button type="button" variant={field.align === 'left' || !field.align ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onUpdate(field.id, { align: 'left' })} disabled={readOnly}><AlignLeft className="h-4 w-4" /></Button>
                    <Button type="button" variant={field.align === 'center' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onUpdate(field.id, { align: 'center' })} disabled={readOnly}><AlignCenter className="h-4 w-4" /></Button>
                    <Button type="button" variant={field.align === 'right' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onUpdate(field.id, { align: 'right' })} disabled={readOnly}><AlignRight className="h-4 w-4" /></Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                    <Checkbox id="required" checked={field.required || false} onCheckedChange={(checked) => onUpdate(field.id, { required: !!checked })} disabled={readOnly} />
                    <Label htmlFor="required" className="text-sm cursor-pointer">必須</Label>
                </div>
                {!['label', 'divider', 'group'].includes(field.type) && (
                    <div className="flex items-center gap-2">
                        <Checkbox id="readOnly" checked={field.readOnly || false} onCheckedChange={(checked) => onUpdate(field.id, { readOnly: !!checked })} disabled={readOnly} />
                        <Label htmlFor="readOnly" className="text-sm cursor-pointer">読取専用</Label>
                    </div>
                )}
                {field.type === 'date' && (
                    <div className="flex items-center gap-2">
                        <Checkbox id="includeTime" checked={field.includeTime || false} onCheckedChange={(checked) => onUpdate(field.id, { includeTime: !!checked })} disabled={readOnly} />
                        <Label htmlFor="includeTime" className="text-sm cursor-pointer">時刻を含める</Label>
                    </div>
                )}
            </div>

            {/* File properties */}
            {field.type === 'file' && (
                <div className="space-y-3 pt-2 border-t">
                    <Label className="text-xs font-semibold">ファイル設定</Label>
                    <div className="space-y-1.5">
                        <Label className="text-xs">許可する拡張子</Label>
                        <Input 
                            value={field.acceptedTypes || ''} 
                            onChange={(e) => onUpdate(field.id, { acceptedTypes: e.target.value })} 
                            placeholder=".pdf,.jpg,.png" 
                            disabled={readOnly}
                            className="text-xs"
                        />
                        <p className="text-[10px] text-muted-foreground">空欄ですべてのファイルを許可</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">最大サイズ (MB)</Label>
                        <Input 
                            type="number" 
                            value={field.maxSize || ''} 
                            onChange={(e) => onUpdate(field.id, { maxSize: e.target.value ? Number(e.target.value) : undefined })} 
                            placeholder="10" 
                            disabled={readOnly}
                            className="text-xs w-24"
                        />
                    </div>
                    {field.multiple && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">最大ファイル数</Label>
                            <Input 
                                type="number" 
                                value={field.maxFiles || ''} 
                                onChange={(e) => onUpdate(field.id, { maxFiles: e.target.value ? Number(e.target.value) : undefined })} 
                                placeholder="無制限" 
                                disabled={readOnly}
                                className="text-xs w-24"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            id="multiple" 
                            checked={field.multiple || false} 
                            onCheckedChange={(checked) => onUpdate(field.id, { multiple: !!checked })} 
                            disabled={readOnly} 
                        />
                        <Label htmlFor="multiple" className="text-sm cursor-pointer">複数ファイルを許可</Label>
                    </div>
                </div>
            )}

            {field.type === 'user-select' && (
                <div className="space-y-3 pt-2 border-t">
                    <Label className="text-xs font-semibold">ユーザー選択設定</Label>
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            id="multiple" 
                            checked={field.multiple || false} 
                            onCheckedChange={(checked) => onUpdate(field.id, { multiple: !!checked })} 
                            disabled={readOnly} 
                        />
                        <Label htmlFor="multiple" className="text-sm cursor-pointer">複数選択を許可</Label>
                    </div>
                </div>
            )}

            {field.type === 'department' && (
                <div className="space-y-3 pt-2 border-t">
                    <Label className="text-xs font-semibold">部署選択設定</Label>
                    <div className="flex items-center gap-2">
                        <Checkbox 
                            id="multiple" 
                            checked={field.multiple || false} 
                            onCheckedChange={(checked) => onUpdate(field.id, { multiple: !!checked })} 
                            disabled={readOnly} 
                        />
                        <Label htmlFor="multiple" className="text-sm cursor-pointer">複数選択を許可</Label>
                    </div>
                </div>
            )}

            {/* Calculation specific properties */}
            {field.type === 'calculation' && (
                <div className="space-y-3 pt-2 border-t">
                    <Label className="text-xs font-semibold">計算式設定</Label>
                    <div className="space-y-1.5">
                        <Label className="text-xs">計算式 (Formula)</Label>
                        <Input 
                            value={field.formula || ''} 
                            onChange={(e) => onUpdate(field.id, { formula: e.target.value })} 
                            placeholder="quantity * price" 
                            disabled={readOnly}
                            className="text-xs font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            フィールドIDを使用して計算式を記述します (+ - * / ( ) が使用可能)
                        </p>
                    </div>
                </div>
            )}

            {/* Data Grid Column Editor */}
            {field.type === 'array' && (
                <div className="space-y-3 pt-2 border-t">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">列定義 (カラム)</Label>
                         <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => {
                                const currentColumns = (field.columns || []) as any[];
                                const newCol = { 
                                    id: `col_${Date.now()}`, 
                                    key: `col_${Date.now()}`, 
                                    label: '新規列', 
                                    type: 'text' 
                                };
                                onUpdate(field.id, { columns: [...currentColumns, newCol] });
                            }}
                            disabled={readOnly}
                        >
                            + 列追加
                        </Button>
                    </div>
                    
                    <div className="space-y-3">
                         {((field.columns || []) as any[]).map((col: any, index: number) => (
                             <div key={index} className="border rounded p-2 space-y-2 bg-muted/20">
                                 <div className="flex items-center justify-between gap-2">
                                     <span className="text-[10px] font-mono text-muted-foreground">#{index + 1}</span>
                                     <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                            const newCols = [...((field.columns || []) as any[])];
                                            newCols.splice(index, 1);
                                            onUpdate(field.id, { columns: newCols });
                                        }}
                                        disabled={readOnly}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 gap-2">
                                     <div className="space-y-1">
                                         <Label className="text-[10px]">列ラベル</Label>
                                         <Input 
                                             value={col.label} 
                                             onChange={(e) => {
                                                 const newCols = [...((field.columns || []) as any[])];
                                                 newCols[index] = { ...newCols[index], label: e.target.value };
                                                 onUpdate(field.id, { columns: newCols });
                                             }}
                                             className="h-7 text-xs"
                                             disabled={readOnly}
                                         />
                                     </div>
                                     <div className="space-y-1">
                                         <Label className="text-[10px]">データキー</Label>
                                         <Input 
                                             value={col.key} 
                                             onChange={(e) => {
                                                  const newCols = [...((field.columns || []) as any[])];
                                                  newCols[index] = { ...newCols[index], key: e.target.value };
                                                  onUpdate(field.id, { columns: newCols });
                                             }}
                                             className="h-7 text-xs font-mono"
                                             disabled={readOnly}
                                         />
                                     </div>
                                 </div>

                                 <div className="space-y-1">
                                     <Label className="text-[10px]">タイプ</Label>
                                     <select 
                                         className="flex h-7 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                         value={col.type}
                                         onChange={(e) => {
                                              const newCols = [...((field.columns || []) as any[])];
                                              newCols[index] = { ...newCols[index], type: e.target.value };
                                              onUpdate(field.id, { columns: newCols });
                                         }}
                                         disabled={readOnly}
                                     >
                                         <option value="text">テキスト</option>
                                         <option value="number">数値</option>
                                         <option value="date">日付</option>
                                         <option value="checkbox">チェックボックス</option>
                                         {/* Select support needs more UI for options, skip for basic v1 or simple text list? */}
                                         {/* <option value="select">セレクト</option> */} 
                                     </select>
                                 </div>
                             </div>
                         ))}
                         {(!field.columns || field.columns.length === 0) && (
                             <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
                                 列が定義されていません
                             </div>
                         )}
                    </div>
                </div>
            )}

            {['select', 'radio', 'checkbox'].includes(field.type) && (
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">選択肢設定</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px]"
                            onClick={() => {
                                const currentOptions = Array.isArray(field.options) ? field.options : [];
                                const nextIndex = currentOptions.length + 1;
                                // Always append an Option object to standardise
                                const newOption = { label: `新規項目${nextIndex}`, value: `opt_${Date.now()}` };
                                const newOptions = [...(field.options || [])] as any[];
                                
                                // Push to array
                                newOptions.push(newOption);
                                
                                onUpdate(field.id, { options: newOptions });
                            }}
                            disabled={readOnly}
                        >
                            + 追加
                        </Button>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="grid grid-cols-[24px_1fr_80px_28px] gap-2 text-[10px] text-muted-foreground px-1">
                            <div className="text-center" title="デフォルト値">既定</div>
                            <div>表示名</div>
                            <div>値</div>
                            <div></div>
                        </div>
                        {((field.options || []) as any[]).map((rawOption: any, index: number) => {
                            // Normalize option for display/editing
                            const option = typeof rawOption === 'string' 
                                ? { label: rawOption, value: rawOption } 
                                : rawOption;

                            const isCheckbox = field.type === 'checkbox';
                            const isSelected = isCheckbox 
                                ? Array.isArray(field.defaultValue) && field.defaultValue.includes(option.value)
                                : field.defaultValue === option.value;
                                
                            return (
                                <div key={index} className="flex items-center gap-2">
                                    {/* Default Value Selector */}
                                    <div className="flex items-center justify-center w-6 h-7">
                                        <div 
                                            className={`
                                                cursor-pointer flex items-center justify-center
                                                ${isCheckbox ? 'w-4 h-4 rounded border' : 'w-4 h-4 rounded-full border'}
                                                ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground hover:bg-muted'}
                                                ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                            onClick={() => {
                                                if (readOnly) return;
                                                if (isCheckbox) {
                                                    const current = Array.isArray(field.defaultValue) ? field.defaultValue : [];
                                                    const newDefaults = isSelected 
                                                        ? current.filter((v: string) => v !== option.value)
                                                        : [...current, option.value];
                                                    onUpdate(field.id, { defaultValue: newDefaults });
                                                } else {
                                                    // Toggle for radio/select
                                                    const newValue = isSelected ? undefined : option.value;
                                                    onUpdate(field.id, { defaultValue: newValue });
                                                }
                                            }}
                                        >
                                            {isSelected && (
                                                isCheckbox 
                                                    ? <div className="h-2.5 w-2.5 bg-current" style={{ clipPath: 'polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)' }} /> 
                                                    : <div className="h-2 w-2 rounded-full bg-current" />
                                            )}
                                        </div>
                                    </div>

                                    <Input
                                        value={option.label}
                                        onChange={(e) => {
                                            // Ensure we work with an array of objects when updating
                                            const newOptions = (field.options || []).map((o: any) => 
                                                typeof o === 'string' ? { label: o, value: o } : { ...o }
                                            );
                                            newOptions[index].label = e.target.value;
                                            onUpdate(field.id, { options: newOptions });
                                        }}
                                        placeholder="表示名"
                                        className="h-7 text-xs flex-1"
                                        disabled={readOnly}
                                    />
                                    <Input
                                        value={option.value}
                                        onChange={(e) => {
                                            const newOptions = (field.options || []).map((o: any) => 
                                                typeof o === 'string' ? { label: o, value: o } : { ...o }
                                            );
                                            const oldValue = option.value;
                                            const newValue = e.target.value;
                                            newOptions[index].value = newValue;
                                            
                                            // Provide update for defaultValue if it matches the old value
                                            const updates: Partial<FormField> = { options: newOptions };
                                            
                                            if (isCheckbox) {
                                                 const current = Array.isArray(field.defaultValue) ? field.defaultValue : [];
                                                 if (current.includes(oldValue)) {
                                                     updates.defaultValue = current.map((v: string) => v === oldValue ? newValue : v);
                                                 }
                                            } else {
                                                if (field.defaultValue === oldValue) {
                                                    updates.defaultValue = newValue;
                                                }
                                            }
                                            
                                            onUpdate(field.id, updates);
                                        }}
                                        placeholder="値"
                                        className="h-7 text-xs w-20 font-mono"
                                        disabled={readOnly}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                            const rawOptions = field.options || [];
                                            // Use index usage so we don't depend on object reference identity mixing
                                            const newOptions = rawOptions.filter((_: any, i: number) => i !== index);
                                            
                                            onUpdate(field.id, { options: newOptions as any });
                                            // Clean up default value if deleted option was selected
                                            const deletedValue = option.value;
                                            if (isCheckbox) {
                                                const current = Array.isArray(field.defaultValue) ? field.defaultValue : [];
                                                if (current.includes(deletedValue)) {
                                                    onUpdate(field.id, { defaultValue: current.filter((v: string) => v !== deletedValue) });
                                                }
                                            } else {
                                                if (field.defaultValue === deletedValue) {
                                                     onUpdate(field.id, { defaultValue: undefined });
                                                }
                                            }
                                        }}
                                        disabled={readOnly}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            );
                        })}
                        {(!field.options || field.options.length === 0) && (
                            <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded bg-muted/30">
                                選択肢がありません
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
