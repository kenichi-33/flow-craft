import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
    GripVertical, Trash2, Calendar, FolderTree, Upload
} from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FormField } from './types';

// --- Sortable Field Component ---
function SortableField({ 
    field, 
    isSelected, 
    onDelete, 
    onClick,
    onUpdate,
    children
}: { 
    field: FormField; 
    isSelected: boolean; 
    onDelete: () => void; 
    onClick: () => void;
    onUpdate?: (id: string, updates: Partial<FormField>) => void;
    children?: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        node
    } = useSortable({ id: field.id, data: { ...field } });

    const [isResizing, setIsResizing] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isResizing ? 'none' : transition, // Disable transition during resize for smoothness
        opacity: isDragging ? 0.4 : 1,
        gridColumn: `span ${field.width || 12}`, 
        zIndex: isResizing || isDragging ? 50 : 'auto',
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent drag start (dnd-kit)
        e.preventDefault();

        if (!node.current?.parentElement) return;

        // Better: Calculate exact widths based on current element.
        // If element is span-X, current width is pixelWidth.
        // pixelWidth / X = singleColWidth.
        const currentRect = node.current.getBoundingClientRect();
        const singleColWidth = currentRect.width / (field.width || 12);
        
        const startX = e.clientX;
        const startWidth = field.width || 12;

        setIsResizing(true);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaCols = Math.round(deltaX / singleColWidth);
            const newWidth = Math.max(1, Math.min(12, startWidth + deltaCols));
            
            if (newWidth !== field.width) {
                 onUpdate?.(field.id, { width: newWidth });
            }
        };

        const handleMouseUp = () => {
             setIsResizing(false);
             window.removeEventListener('mousemove', handleMouseMove);
             window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div ref={setNodeRef} style={style} onClick={(e) => { e.stopPropagation(); onClick(); }} className="h-full relative">
            <FieldPreview field={field} isSelected={isSelected} onDelete={onDelete} dragHandleProps={{ ...attributes, ...listeners }}>
                {children}
            </FieldPreview>
            
            {isSelected && onUpdate && (
                <div 
                    className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-4 h-12 cursor-col-resize hover:bg-muted-foreground/20 flex items-center justify-center rounded z-20 touch-none"
                    onMouseDown={handleResizeStart}
                    title="ドラッグして幅を変更"
                >
                    <div className="h-8 w-1 bg-muted-foreground/50 rounded-full" />
                </div>
            )}
        </div>
    );
}

// --- FieldPreview Component (Presentation) ---
// This is exported so it can be used in DragOverlay as well
export function FieldPreview({ field, isSelected, onDelete, dragHandleProps, children }: { field: FormField; isSelected: boolean; onDelete?: () => void; dragHandleProps?: any; children?: React.ReactNode }) {
    // Determine if it's a structural element (divider, label) for different styling
    const isStructural = ['divider', 'label'].includes(field.type);

    return (
        <div className={`
            h-full rounded-md transition-all relative group
            ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/30 hover:ring-1 hover:ring-muted-foreground/30'}
            ${isStructural ? 'py-2 px-3' : 'p-2'}
        `}>
            {/* Action Bar (Top Right) - Only visible on hover/select */}
            <div className={`absolute top-1 right-1 flex items-center gap-1 z-10 transition-opacity ${isSelected || 'group-hover:opacity-100 opacity-0'}`}>
                {dragHandleProps && (
                    <div {...dragHandleProps} className="cursor-grab hover:text-primary active:cursor-grabbing p-1 hover:bg-background rounded shadow-sm border">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                )}
                {onDelete && (
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 bg-background/50 hover:bg-destructive hover:text-destructive-foreground rounded shadow-sm border" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {/* Field Content */}
            <div className={`pointer-events-none opacity-90 ${field.type === 'group' ? 'h-full' : ''}`}>
                {/* Header (Label & Icon) */}
                {!isStructural && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-foreground">{field.label}</span>
                        {field.required && <span className="text-destructive text-xs">*</span>}
                        {field.width && field.width < 12 && <span className="text-[10px] text-muted-foreground px-1 border rounded bg-background/50">w:{field.width}</span>}
                    </div>
                )}

                {/* Body (Mockup) */}
                <div className="text-sm text-muted-foreground h-full">
                    {field.type === 'text' && <div className="h-9 bg-background border rounded px-3 flex items-center shadow-sm w-full"></div>}
                    {field.type === 'textarea' && <div className="h-20 bg-background border rounded px-3 py-2 shadow-sm w-full"></div>}
                    {field.type === 'number' && <div className="h-9 bg-background border rounded px-3 flex items-center shadow-sm w-32"></div>}
                    
                    {field.type === 'select' && (
                        <div className="h-9 bg-background border rounded px-3 flex items-center justify-between shadow-sm w-full">
                            <span>
                                {field.defaultValue 
                                    ? (field.options as any[])?.find((o: any) => o.value === field.defaultValue)?.label 
                                    : ((field.options as any[])?.[0]?.label || '選択してください')}
                            </span>
                            <div className="h-4 w-4 border-l pl-2 flex items-center justify-center opacity-50">▼</div>
                        </div>
                    )}
                    
                    {field.type === 'radio' && (
                        <div className="flex gap-4 flex-wrap">
                            {field.options && field.options.length > 0 ? field.options.map((opt: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${field.defaultValue === opt.value ? 'bg-primary border-primary' : ''}`}>
                                        {field.defaultValue === opt.value && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                                    </div>
                                    <span>{opt.label}</span>
                                </div>
                            )) : (
                                <span className="text-xs text-muted-foreground">選択肢なし</span>
                            )}
                        </div>
                    )}
                    
                    {field.type === 'checkbox' && (
                        <div className="flex gap-4 flex-wrap">
                            {field.options && field.options.length > 0 ? field.options.map((opt: any, i: number) => {
                                const isChecked = Array.isArray(field.defaultValue) && field.defaultValue.includes(opt.value);
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${isChecked ? 'bg-primary border-primary' : ''}`}>
                                            {isChecked && <div className="h-2.5 w-2.5 bg-primary-foreground" style={{ clipPath: 'polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)' }} />}
                                        </div>
                                        <span>{opt.label}</span>
                                    </div>
                                );
                            }) : (
                                <span className="text-xs text-muted-foreground">選択肢なし</span>
                            )}
                        </div>
                    )}
                    
                    {field.type === 'date' && (
                        <div className="h-9 bg-background border rounded px-3 flex items-center justify-between shadow-sm w-40">
                            <span>{field.includeTime ? 'YYYY/MM/DD HH:mm' : 'YYYY/MM/DD'}</span>
                            <Calendar className="h-4 w-4 opacity-50" />
                        </div>
                    )}

                    {field.type === 'dateRange' && (
                        <div className="flex items-center gap-2">
                             <div className="h-9 bg-background border rounded px-3 flex items-center justify-between shadow-sm w-36">
                                <span>Start Date</span>
                                <Calendar className="h-4 w-4 opacity-50" />
                            </div>
                            <span className="text-muted-foreground">~</span>
                            <div className="h-9 bg-background border rounded px-3 flex items-center justify-between shadow-sm w-36">
                                <span>End Date</span>
                                <Calendar className="h-4 w-4 opacity-50" />
                            </div>
                        </div>
                    )}
                    
                    {field.type === 'time' && (
                        <div className="h-9 bg-background border rounded px-3 flex items-center justify-between shadow-sm w-32">
                            <span>HH:mm</span>
                            <div className="h-4 w-4 opacity-50 flex items-center justify-center">🕒</div>
                        </div>
                    )}

                    {field.type === 'file' && (
                        <div className="border-2 border-dashed rounded-lg p-4 bg-background shadow-sm text-center">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-xs">ファイルをドラッグ&ドロップ</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {field.acceptedTypes ? `許可: ${field.acceptedTypes}` : 'すべてのファイル'}
                                {field.maxSize ? ` / 最大 ${field.maxSize}MB` : ''}
                            </p>
                        </div>
                    )}

                    {field.type === 'divider' && <div className="border-t my-2 border-border/50"></div>}
                    
                    {field.type === 'label' && (
                        <div className={`font-bold text-lg text-${field.align || 'left'} text-foreground border-b pb-1 mb-2`}>
                            {field.label}
                        </div>
                    )}
                    
                    {field.type === 'group' && (
                        <div className="border border-dashed rounded p-3 bg-muted/20 min-h-[100px] pointer-events-auto">
                           <div className="text-xs font-semibold mb-2 flex items-center gap-1 text-muted-foreground"><FolderTree className="h-3 w-3" /> {field.label}</div>
                           <div className="space-y-2">
                               {children}
                               {React.Children.count(children) === 0 && (
                                   <div className="h-10 border-2 border-dotted border-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                                       ドロップエリア
                                   </div>
                               )}
                           </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function RecursiveFieldList({ 
    fields, 
    selectedFieldId, 
    onSelect, 
    onDelete, 
    onUpdate,
    isReadOnly 
}: { 
    fields: FormField[]; 
    selectedFieldId: string | null; 
    onSelect: (id: string) => void; 
    onDelete: (id: string) => void; 
    onUpdate?: (id: string, updates: Partial<FormField>) => void;
    isReadOnly: boolean;
}) {
    return (
        <SortableContext items={fields.map(f => f.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-12 gap-4">
                {fields.map((field) => (
                    <SortableField 
                        key={field.id} 
                        field={field} 
                        isSelected={selectedFieldId === field.id} 
                        onDelete={() => !isReadOnly && onDelete(field.id)}
                        onClick={() => onSelect(field.id)}
                        onUpdate={!isReadOnly ? onUpdate : undefined}
                    >
                        {field.children && (
                            <RecursiveFieldList 
                                fields={field.children}
                                selectedFieldId={selectedFieldId}
                                onSelect={onSelect}
                                onDelete={onDelete}
                                onUpdate={onUpdate}
                                isReadOnly={isReadOnly}
                            />
                        )}
                    </SortableField>
                ))}
            </div>
        </SortableContext>
    );
}

export default function FormEditorCanvas({ 
    fields, 
    selectedFieldId, 
    onSelect, 
    onDelete, 
    onUpdate,
    isReadOnly 
}: { 
    fields: FormField[]; 
    selectedFieldId: string | null; 
    onSelect: (id: string) => void; 
    onDelete: (id: string) => void; 
    onUpdate?: (id: string, updates: Partial<FormField>) => void;
    isReadOnly: boolean;
}) {
    // IMPORTANT: Drop target is on the outer container
    const { setNodeRef, isOver } = useDroppable({
        id: 'canvas-drop-area',
    });

    return (
        <div 
            ref={setNodeRef}
            className={`flex-1 p-4 overflow-auto bg-muted/50 relative transition-all duration-200 ${isOver ? 'bg-primary/5 ring-2 ring-primary ring-inset' : ''}`}
        >
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            
            <div className={`relative z-10 min-h-[600px] max-w-5xl mx-auto ${fields.length === 0 ? 'h-full flex items-center justify-center' : ''}`}>
               {fields.length === 0 && (
                   <div className="text-center text-muted-foreground p-8 border-2 border-dashed border-muted-foreground/20 rounded-xl bg-background/50 backdrop-blur-sm pointer-events-none">
                       <p className="text-sm">左側のツールボックスからアイテムをドラッグ＆ドロップしてください</p>
                   </div>
               )}
               
               {fields.length > 0 && (
                <div className="text-center mb-3">
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">グリッドレイアウト - ドラッグして並べ替え</span>
                </div>
               )}

                <RecursiveFieldList 
                    fields={fields} 
                    selectedFieldId={selectedFieldId} 
                    onSelect={onSelect} 
                    onDelete={onDelete} 
                    onUpdate={onUpdate}
                    isReadOnly={isReadOnly}
                />
            </div>
        </div>
    );
}

