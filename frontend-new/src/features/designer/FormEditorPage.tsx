import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    DndContext, 
    DragOverlay, 
    MouseSensor,
    TouchSensor, 
    useSensor, 
    useSensors, 
    pointerWithin,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { Eye, Edit3, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

import FormEditorToolbox from './editor/FormEditorToolbox';
import FormEditorCanvas, { FieldPreview } from './editor/FormEditorCanvas';
import FormEditorProperties from './editor/FormEditorProperties';
import DynamicFormRenderer from '@/components/application/DynamicFormRenderer';
import type { FormField } from './editor/types';

// Utility to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

// Recursive helpers
const findFieldRecursive = (items: FormField[], id: string): FormField | undefined => {
    for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
            const found = findFieldRecursive(item.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

const updateFieldRecursive = (items: FormField[], id: string, updates: Partial<FormField>): FormField[] => {
    return items.map(item => {
        if (item.id === id) {
            return { ...item, ...updates };
        }
        if (item.children) {
            return { ...item, children: updateFieldRecursive(item.children, id, updates) };
        }
        return item;
    });
};

const deleteFieldRecursive = (items: FormField[], id: string): FormField[] => {
    return items.filter(item => item.id !== id).map(item => {
        if (item.children) {
            return { ...item, children: deleteFieldRecursive(item.children, id) };
        }
        return item;
    });
};

// Flatten for validation/lookup if needed, but better to use recursive search
const getAllFieldsFlattened = (items: FormField[]): FormField[] => {
    let result: FormField[] = [];
    items.forEach(item => {
        result.push(item);
        if (item.children) {
            result = [...result, ...getAllFieldsFlattened(item.children)];
        }
    });
    return result;
};

export default function FormEditorPage() {
    const { id, versionId } = useParams();
    const isReadOnly = !!versionId;
    const queryClient = useQueryClient();
    const [fields, setFields] = useState<FormField[]>([]);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<any | null>(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // Fetch Application Definition
    const { data: appDef, isLoading } = useQuery({
        queryKey: ['application-definition', id],
        queryFn: async () => {
            const res = await api.get<any>(`/application-definitions/${id}`);
            return res;
        },
        enabled: !!id,
    });

    // Fetch Versions (for read-only mode)
    const { data: versions } = useQuery({
        queryKey: ['application-definition-versions', id],
        queryFn: async () => {
            return api.get<any[]>(`/application-definitions/${id}/versions`);
        },
        enabled: !!id && isReadOnly,
    });



    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            let formId = appDef?.formDefinition?.id;
            
            if (!formId) {
                // 1. Create new form
                const newForm = await api.post<any>('/forms', {
                    name: `${appDef?.appName || 'New Application'} Form`,
                    schema: data.schema
                });
                
                formId = newForm.id;

                // 2. Link to Application Definition
                await api.put(`/application-definitions/${id}`, {
                    formDefinitionId: formId
                });
                
                return newForm;
            } else {
                // Update existing form
                return api.put(`/forms/${formId}`, {
                    schema: data.schema,
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', id] });
            toast.success('一時保存しました');
        },
        onError: (error) => {
             console.error('Save failed:', error);
             toast.error('保存に失敗しました');
        }
    });

    // Initialize fields from schema
    useEffect(() => {
        let targetSchema = null;

        if (isReadOnly && versions) {
             const version = versions.find((v: any) => String(v.version) === String(versionId) || String(v.id) === String(versionId));
             // Assuming version object has formDefinition snapshot or similar?
             // Need to check backend version structure. 
             // In FlowEditorPage: "if (version && version.flowNodes)..."
             // Typically version snapshot stores definitions.
             // If not available, we might need to rely on what backend returns.
             // Assuming version object contains: { formDefinition: { schema: ... } }
             if (version?.formDefinition?.schema) {
                 targetSchema = version.formDefinition.schema;
             }
        } else if (appDef?.formDefinition?.schema) {
            targetSchema = appDef.formDefinition.schema;
        }

        if (targetSchema) {
            const schema = targetSchema;
            const properties = schema.properties || {};
            const layout = schema['x-layout'] || [];
            
            const initialFields: FormField[] = Object.entries(properties).map(([fieldId, config]: [string, any]) => ({
                id: fieldId,
                type: config.type || config['x-type'] || 'text',
                label: config.title || config.label || '名称未設定',
                required: (schema.required || []).includes(fieldId),
                options: config.options || config.enum || [],
                description: config.description,
                includeTime: config.includeTime,
                align: config.align,
                readOnly: config.readOnly,
                // Attempt to find width from layout
                width: layout.find((l: any) => l.i === fieldId)?.w || 12,
            }));

            // Sort by layout y, then x
            initialFields.sort((a, b) => {
                const la = layout.find((l: any) => l.i === a.id) || { x: 0, y: 0 };
                const lb = layout.find((l: any) => l.i === b.id) || { x: 0, y: 0 };
                return la.y === lb.y ? la.x - lb.x : la.y - lb.y;
            });

            setFields(initialFields);
        }
    }, [appDef, versions, isReadOnly, versionId]);

    // Sensors
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    );

    // Helper to find parent container id
    const findParentId = (items: FormField[], id: string): string | null => {
        if (items.some(i => i.id === id)) return 'root';
        for (const item of items) {
            if (item.children) {
                if (item.children.some(c => c.id === id)) return item.id;
                const found = findParentId(item.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (isReadOnly) return;
        const { active } = event;
        setActiveDragItem(active.data.current);
    };

    const handleDragOver = (event: DragEndEvent) => {
        if (isReadOnly) return;
        const { active, over } = event;
        if (!over) return;
        
        // Only handle re-sorting of existing fields during drag
        if (active.data.current?.isToolboxItem) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find containers
        const activeContainer = findParentId(fields, activeId);
        const overContainer = findParentId(fields, overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        // Move item to new container's state during drag to allow "visual" move
        setFields((prev) => {
            const activeItems = activeContainer === 'root' ? prev : findFieldRecursive(prev, activeContainer)?.children || [];
            const overItems = overContainer === 'root' ? prev : findFieldRecursive(prev, overContainer)?.children || [];
            
            const activeIndex = activeItems.findIndex(i => i.id === activeId);
            const overIndex = overItems.findIndex(i => i.id === overId);

            let newIndex;
            if (overId in prev) { // We are over a container placeholder? No.
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            // Deep clone to modify
            const deepClone = JSON.parse(JSON.stringify(prev));
            
            // Remove from source
            const sourceList = activeContainer === 'root' ? deepClone : findFieldRecursive(deepClone, activeContainer)!.children!;
            const [movedItem] = sourceList.splice(activeIndex, 1);

            // Add to target
            const targetList = overContainer === 'root' ? deepClone : findFieldRecursive(deepClone, overContainer)!.children!;
            
            // Should initiate children if undefined?
            // findFieldRecursive returning reference allows modification?
            // Yes if deepClone is the root.
            
            // Check if target is actually the Group itself?
            // If I drag over a Group, overContainer is 'root' (if group is in root).
            // But I want to drop INTO the group.
            // This logic moves it NEXT to the group.
            
            // Handling "Into Group": 
            // If over is a Group and we haven't moved into it yet?
            // Only if we hover strictly over the content?
            // dnd-kit Sortable doesn't distinguish nicely.
            
            // Simpler: Just handle regular list movement.
            // If I want to move INTO a group, I should drag over a child of that group.
            // What if group is empty?
            
            targetList.splice(newIndex, 0, movedItem);
            
            return deepClone;
        });
    };
    
    // Better handleDragOver to support moving INTO group when hovering group?
    // Actually, let's stick to `handleDragEnd` for structure changes to avoid jitter, 
    // OR implement the robust `dnd-kit` examples.
    // Given the complexity of "Moving Into" vs "Reordering Next To", 
    // simple list movement in DragOver is often enough IF we have a way to target the group.
    
    // Revised Strategy:
    // Only handle reordering in handleDragEnd for simplicity and stability first.
    // If I want to drop into a group, I handle it at the Drop event.
    // If I drop ON a group object, I insert it as the last child.
    
    const handleDragEnd = (event: DragEndEvent) => {
        if (isReadOnly) return;
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        // 1. Drop from Toolbox
        if (active.data.current?.isToolboxItem) {
            const type = active.data.current.type;
            const newField: FormField = {
                id: generateId(),
                type,
                label: active.data.current.label,
                required: false,
                width: 12
            };
             if (['select', 'radio', 'checkbox'].includes(type)) {
                newField.options = [{ label: 'オプション1', value: 'opt1' }];
            }
            if (type === 'label') newField.label = '見出しテキスト';
            if (type === 'divider') newField.label = '区切り線';

            setFields((prev) => {
                // Determine drop target
                // If dropped on a Group (field.type === 'group'), append to its children
                const overField = findFieldRecursive(prev, over.id as string);
                if (overField && overField.type === 'group') {
                     // Add to group
                     return updateFieldRecursive(prev, overField.id, {
                         children: [...(overField.children || []), newField]
                     });
                }
                
                // If dropped on an item inside a group, find parent and insert
                const parentId = findParentId(prev, over.id as string);
                if (parentId && parentId !== 'root') {
                    // It's inside a group
                    const parent = findFieldRecursive(prev, parentId)!;
                    const index = parent.children?.findIndex(c => c.id === over.id) ?? -1;
                    const newChildren = [...(parent.children || [])];
                    if (index >= 0) newChildren.splice(index + 1, 0, newField); // Insert after
                    else newChildren.push(newField);
                    
                    return updateFieldRecursive(prev, parentId, { children: newChildren });
                }

                // Default: Add to root (at end or specific index?)
                // If over is generic field in root, insert after?
                const index = prev.findIndex(f => f.id === over.id);
                if (index >= 0) {
                    const newRoot = [...prev];
                    newRoot.splice(index + 1, 0, newField);
                    return newRoot;
                }
                
                return [...prev, newField];
            });
            setSelectedFieldId(newField.id);
            toast.success(`${newField.label}を追加しました`);
            return;
        }

        // 2. Reordering Existing Items
        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        setFields((prev) => {
            const sourceParentId = findParentId(prev, activeId);
            const targetParentId = findParentId(prev, overId);
            
            // Check if Dropping ONTO a group (to move inside)
            const overField = findFieldRecursive(prev, overId);
            if (overField && overField.type === 'group' && sourceParentId !== overId) {
                // Moving activeId INTO overId (Group)
                // 1. Remove from source
                // We need more complex logic to remove/add in one pass or use helpers
                // Let's use deep clone for safety
                const deepClone = JSON.parse(JSON.stringify(prev));
                
                // Remove
                const sourceList = sourceParentId === 'root' ? deepClone : findFieldRecursive(deepClone, sourceParentId!)!.children!;
                const sourceIndex = sourceList.findIndex((i: any) => i.id === activeId);
                const [movedItem] = sourceList.splice(sourceIndex, 1);
                
                // Add to target Group
                const targetGroup = findFieldRecursive(deepClone, overId)!;
                if (!targetGroup.children) targetGroup.children = [];
                targetGroup.children.push(movedItem);
                
                return deepClone;
            }

            // Normal Reorder (Same Container or Sibling)
            if (sourceParentId === targetParentId) {
                 const deepClone = JSON.parse(JSON.stringify(prev));
                 const list = sourceParentId === 'root' ? deepClone : findFieldRecursive(deepClone, sourceParentId!)!.children!;
                 const oldIndex = list.findIndex((i: any) => i.id === activeId);
                 const newIndex = list.findIndex((i: any) => i.id === overId);
                 
                 // If moving in same list, simple arrayMove
                 // But wait, arrayMove returns new array, I need to mutate the container
                 if (sourceParentId === 'root') {
                     return arrayMove(deepClone, oldIndex, newIndex);
                 } else {
                     const group = findFieldRecursive(deepClone, sourceParentId!)!;
                     group.children = arrayMove(list, oldIndex, newIndex);
                     return deepClone;
                 }
            }
            
            // Moving between different lists (e.g. out of group, or into sibling group)
            // But NOT dropping ON the group header (handled above).
            // This handles dropping onto a CHILD of another group.
            
            const deepClone = JSON.parse(JSON.stringify(prev));
            const sourceList = sourceParentId === 'root' ? deepClone : findFieldRecursive(deepClone, sourceParentId!)!.children!;
            const targetList = targetParentId === 'root' ? deepClone : findFieldRecursive(deepClone, targetParentId!)!.children!;
            
            const sourceIndex = sourceList.findIndex((i: any) => i.id === activeId);
            const [movedItem] = sourceList.splice(sourceIndex, 1);
            
            const targetIndex = targetList.findIndex((i: any) => i.id === overId);
            // Insert after or before? Sortable default is usually swap, so "at index".
             targetList.splice(targetIndex, 0, movedItem);
             
             return deepClone;
        });
    };

    const handleFieldUpdate = (id: string, updates: Partial<FormField>) => {
        if (isReadOnly) return;
        
        // Handle ID change duplicate check
        if (updates.id && updates.id !== id) {
            const allFields = getAllFieldsFlattened(fields);
            const isDuplicate = allFields.some(f => f.id === updates.id);
            if (isDuplicate) {
                toast.error('このフィールドIDは既に使用されています');
                return;
            }
        }
        
        setFields(prev => updateFieldRecursive(prev, id, updates));
        
        if (updates.id && id === selectedFieldId) {
            setSelectedFieldId(updates.id);
        }
    };

    const handleDelete = (id: string) => {
        if (isReadOnly) return;
        setFields(prev => deleteFieldRecursive(prev, id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    // Convert fields to schema for preview
    const generatePreviewSchema = () => {
        const properties: Record<string, any> = {};
        const layout: any[] = [];
        const required: string[] = [];

        const processFields = (items: FormField[], parentId?: string) => {
            items.forEach((field) => {
                properties[field.id] = {
                    type: field.type,
                    title: field.label,
                    description: field.description,
                    readOnly: field.readOnly,
                    // Map custom props
                    options: field.options,
                    includeTime: field.includeTime,
                    align: field.align,
                    // Persist x-type if needed for reconstruction
                    'x-type': field.type,
                    'x-parent': parentId, // Add hierarchy
                    default: field.defaultValue, 
                };
                
                if (field.required) required.push(field.id);

                layout.push({
                    i: field.id,
                    x: 0, 
                    y: layout.length * 2, // Simple sequential layout
                    w: field.width || 12,
                    h: 2
                });

                if (field.children) {
                    processFields(field.children, field.id);
                }
            });
        };

        processFields(fields);

        return {
            schema: { 
                type: 'object', 
                properties, 
                required,
                'x-layout': layout // Save layout in schema
            },
            layout: layout
        };
    };

    const handleSave = () => {
        if (isReadOnly) return;
        console.log('Save clicked', { appDef, fields });
        if (!appDef) {
            toast.error('アプリケーション定義が読み込まれていません');
            return;
        }
        const { schema } = generatePreviewSchema();
        console.log('Generated Schema:', schema);
        saveMutation.mutate({ schema });
    };

    const selectedField = selectedFieldId ? findFieldRecursive(fields, selectedFieldId) || null : null;
    const previewData = isPreviewMode ? generatePreviewSchema() : null;

    if (isLoading) {
         return (
             <div className="h-full flex items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
         );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full flex flex-col bg-background">
                {/* Header */}
                <header className="h-14 border-b flex items-center justify-between px-4 bg-background z-20">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-lg">フォームエディタ</h2>
                        {appDef && <span className="text-sm text-muted-foreground ml-2">- {appDef.appName} {isReadOnly && '(読取専用)'}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={isPreviewMode ? "outline" : "default"} 
                            size="sm" 
                            onClick={() => setIsPreviewMode(!isPreviewMode)}
                            className="gap-2"
                        >
                            {isPreviewMode ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {isPreviewMode ? '編集に戻る' : 'プレビュー'}
                        </Button>
                        {!isReadOnly && (
                            <Button 
                                size="sm" 
                                className="gap-2" 
                                disabled={isPreviewMode || saveMutation.isPending} 
                                onClick={handleSave}
                            >
                                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                一時保存
                            </Button>
                        )}
                    </div>
                </header>
                
                {isPreviewMode && previewData ? (
                    <div className="flex-1 overflow-auto p-8 bg-muted/30 flex justify-center">
                        <div className="w-full max-w-4xl bg-background rounded-xl border shadow-sm p-8 h-fit">
                            <h3 className="text-xl font-bold mb-6 text-center border-b pb-4">プレビューモード</h3>
                            <DynamicFormRenderer 
                                schema={previewData.schema}
                                layouts={{ lg: previewData.layout }}
                                onSubmit={(data) => {
                                    // Popup output as requested
                                    toast.message('フォーム出力結果', {
                                        description: (
                                            <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 overflow-auto text-xs text-white">
                                                {JSON.stringify(data, null, 2)}
                                            </pre>
                                        ),
                                    });
                                }}
                                renderActions={(methods) => (
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => methods.reset()}>リセット</Button>
                                        <Button type="submit">申請する</Button>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Sidebar: Toolbox */}
                        {!isReadOnly && (
                            <div className="w-64 border-r bg-muted/10 flex flex-col">
                                <div className="p-4 border-b font-semibold text-sm">コンポーネント</div>
                                <div className="flex-1 overflow-auto p-4">
                                    <FormEditorToolbox />
                                </div>
                            </div>
                        )}

                        {/* Center: Canvas */}
                        <FormEditorCanvas 
                            fields={fields} 
                            selectedFieldId={selectedFieldId} 
                            onSelect={setSelectedFieldId}
                            onDelete={handleDelete}
                            onUpdate={handleFieldUpdate}
                            isReadOnly={isReadOnly}
                        />

                        {/* Right Sidebar: Properties */}
                        <div className="w-80 border-l bg-background flex flex-col overflow-y-auto">
                            <FormEditorProperties
                                field={selectedField}
                                onUpdate={handleFieldUpdate}
                                readOnly={isReadOnly}
                            />
                        </div>
                    </div>
                )}

                {!isPreviewMode && (
                    <DragOverlay>
                        {activeDragItem ? (
                            activeDragItem.isToolboxItem ? (
                                <div className="p-2 bg-background border rounded-lg shadow-lg opacity-80 cursor-grabbing w-40">
                                    <span className="text-sm font-medium">{activeDragItem.label}</span>
                                </div>
                            ) : (
                                // Use a simplified preview for dragging existing items
                                <div className="w-full opacity-80 cursor-grabbing bg-background">
                                    <FieldPreview field={activeDragItem} isSelected={false} />
                                </div>
                            )
                        ) : null}
                    </DragOverlay>
                )}
            </div>
        </DndContext>
    );
}
