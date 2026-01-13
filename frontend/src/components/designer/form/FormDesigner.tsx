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
    type DragStartEvent, 
    type DragEndEvent
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { Eye, Edit3, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

import FormEditorToolbox from './FormEditorToolbox';
import FormEditorCanvas, { FieldPreview } from './FormEditorCanvas';
import FormEditorProperties from './FormEditorProperties';
import DynamicFormRenderer from '@/components/model/form/renderer/DynamicFormRenderer';
import type { FormField } from './types';
import { generateId, findFieldRecursive, updateFieldRecursive, deleteFieldRecursive, getAllFieldsFlattened, findParentId } from './utils';

export default function FormDesigner({ appId }: { appId: string }) {
    const { versionId } = useParams();
    const isReadOnly = !!versionId;
    const queryClient = useQueryClient();
    const [fields, setFields] = useState<FormField[]>([]);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<any | null>(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);

    // Fetch Application Definition
    const { data: appDef, isLoading } = useQuery({
        queryKey: ['application-definition', appId],
        queryFn: async () => {
            const res = await api.get<any>(`/application-definitions/${appId}`);
            return res;
        },
        enabled: !!appId,
    });

    // Fetch Versions (for read-only mode)
    const { data: versions } = useQuery({
        queryKey: ['application-definition-versions', appId],
        queryFn: async () => {
            return api.get<any[]>(`/application-definitions/${appId}/versions`);
        },
        enabled: !!appId && isReadOnly,
    });

    // Save Mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            let formId = appDef?.formDefinition?.id;
            
            if (!formId) {
                const newForm = await api.post<any>('/forms', {
                    name: `${appDef?.appName || 'New Application'} Form`,
                    schema: data.schema
                });
                
                formId = newForm.id;
                await api.put(`/application-definitions/${appId}`, {
                    formDefinitionId: formId
                });
                return newForm;
            } else {
                return api.put(`/forms/${formId}`, { schema: data.schema });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['application-definition', appId] });
            toast.success('一時保存しました');
        },
        onError: (error) => {
             console.error('Save failed:', error);
             toast.error('保存に失敗しました');
        }
    });

    useEffect(() => {
        let targetSchema = null;
        if (isReadOnly && versions) {
             const version = versions.find((v: any) => String(v.version) === String(versionId) || String(v.id) === String(versionId));
             if (version?.formDefinition?.schema) targetSchema = version.formDefinition.schema;
        } else if (appDef?.formDefinition?.schema) {
            targetSchema = appDef.formDefinition.schema;
        }

        if (targetSchema) {
            const schema = targetSchema;
            const properties = schema.properties || {};
            const layout = schema['x-layout'] || [];
            
            const allFields: FormField[] = Object.entries(properties).map(([fieldId, config]: [string, any]) => ({
                id: fieldId,
                type: config.type || config['x-type'] || 'text',
                label: config.title || config.label || '名称未設定',
                required: (schema.required || []).includes(fieldId),
                options: config.options || config.enum || [],
                description: config.description,
                includeTime: config.includeTime,
                align: config.align,
                readOnly: config.readOnly,
                multiple: config.multiple,
                maxFiles: config.maxFiles,
                maxSize: config.maxSize,
                acceptedTypes: config.acceptedTypes,
                formula: config.formula,
                pattern: config.pattern,
                columns: config.items ? Object.entries(config.items.properties || {}).map(([key, prop]: [string, any]) => ({
                    id: key, 
                    key: key,
                    type: prop.type,
                    label: prop.title || prop.label || key,
                })) : undefined,
                width: layout.find((l: any) => l.i === fieldId)?.w || 12,
                children: [], // Initialize children
            }));

            // Hierarchy Reconstruction
            const rootFields: FormField[] = [];
            const fieldMap = new Map<string, FormField>();
            allFields.forEach(f => fieldMap.set(f.id, f));

            allFields.forEach(f => {
                const config = properties[f.id];
                const parentId = config['x-parent'];
                
                if (parentId && fieldMap.has(parentId)) {
                    const parent = fieldMap.get(parentId)!;
                    parent.children = parent.children || [];
                    parent.children.push(f);
                } else {
                    rootFields.push(f);
                }
            });

            // Sorting helper
            const sortByLayout = (a: FormField, b: FormField) => {
                const la = layout.find((l: any) => l.i === a.id) || { x: 0, y: 0 };
                const lb = layout.find((l: any) => l.i === b.id) || { x: 0, y: 0 };
                return la.y === lb.y ? la.x - lb.x : la.y - lb.y;
            };

            // Recursive sorting
            const sortRecursive = (items: FormField[]) => {
                items.sort(sortByLayout);
                items.forEach(item => {
                    if (item.children && item.children.length > 0) {
                        sortRecursive(item.children);
                    }
                });
            };

            sortRecursive(rootFields);
            setFields(rootFields);
        }
    }, [appDef, versions, isReadOnly, versionId]);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    );

    const handleDragStart = (event: DragStartEvent) => {
        if (isReadOnly) return;
        const { active } = event;
        setActiveDragItem(active.data.current);
    };

    const handleDragOver = (event: DragEndEvent) => {
        if (isReadOnly) return;
        const { active, over } = event;
        if (!over) return;
        
        if (active.data.current?.isToolboxItem) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        const activeContainer = findParentId(fields, activeId);
        const overContainer = findParentId(fields, overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) return;

        setFields((prev) => {
            const activeItems = activeContainer === 'root' ? prev : findFieldRecursive(prev, activeContainer)?.children || [];
            const overItems = overContainer === 'root' ? prev : findFieldRecursive(prev, overContainer)?.children || [];
            
            const activeIndex = activeItems.findIndex(i => i.id === activeId);
            const overIndex = overItems.findIndex(i => i.id === overId);

            let newIndex;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            const deepClone = JSON.parse(JSON.stringify(prev));
            const sourceList = activeContainer === 'root' ? deepClone : findFieldRecursive(deepClone, activeContainer)!.children!;
            const [movedItem] = sourceList.splice(activeIndex, 1);
            const targetList = overContainer === 'root' ? deepClone : findFieldRecursive(deepClone, overContainer)!.children!;
            
            targetList.splice(newIndex, 0, movedItem);
            return deepClone;
        });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        if (isReadOnly) return;
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

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
            if (type === 'user-select') {
                newField.width = 6;
                newField.multiple = false;
            }
            if (type === 'array') {
                newField.label = '明細テーブル';
                newField.width = 12;
                newField.columns = [
                    { id: generateId(), type: 'text', label: '項目1', key: 'item1' },
                    { id: generateId(), type: 'number', label: '金額', key: 'amount' }
                ];
            }

            setFields((prev) => {
                const overField = findFieldRecursive(prev, over.id as string);
                if (overField && overField.type === 'group') {
                     return updateFieldRecursive(prev, overField.id, {children: [...(overField.children || []), newField]});
                }
                
                const parentId = findParentId(prev, over.id as string);
                if (parentId && parentId !== 'root') {
                    const parent = findFieldRecursive(prev, parentId)!;
                    const index = parent.children?.findIndex(c => c.id === over.id) ?? -1;
                    const newChildren = [...(parent.children || [])];
                    if (index >= 0) newChildren.splice(index + 1, 0, newField);
                    else newChildren.push(newField);
                    return updateFieldRecursive(prev, parentId, { children: newChildren });
                }

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

        const activeId = active.id as string;
        const overId = over.id as string;
        if (activeId === overId) return;

        setFields((prev) => {
            const sourceParentId = findParentId(prev, activeId);
            const targetParentId = findParentId(prev, overId);
            const overField = findFieldRecursive(prev, overId);
            
            if (overField && overField.type === 'group' && sourceParentId !== overId) {
                const deepClone = JSON.parse(JSON.stringify(prev));
                const sourceList = sourceParentId === 'root' ? deepClone : findFieldRecursive(deepClone, sourceParentId!)!.children!;
                const sourceIndex = sourceList.findIndex((i: any) => i.id === activeId);
                const [movedItem] = sourceList.splice(sourceIndex, 1);
                
                const targetGroup = findFieldRecursive(deepClone, overId)!;
                if (!targetGroup.children) targetGroup.children = [];
                targetGroup.children.push(movedItem);
                return deepClone;
            }

            if (sourceParentId === targetParentId) {
                 const deepClone = JSON.parse(JSON.stringify(prev));
                 const list = sourceParentId === 'root' ? deepClone : findFieldRecursive(deepClone, sourceParentId!)!.children!;
                 const oldIndex = list.findIndex((i: any) => i.id === activeId);
                 const newIndex = list.findIndex((i: any) => i.id === overId);
                 
                 if (sourceParentId === 'root') return arrayMove(deepClone, oldIndex, newIndex);
                 else {
                     const group = findFieldRecursive(deepClone, sourceParentId!)!;
                     group.children = arrayMove(list, oldIndex, newIndex);
                     return deepClone;
                 }
            }
            
            const deepClone = JSON.parse(JSON.stringify(prev));
            const sourceList = sourceParentId === 'root' ? deepClone : findFieldRecursive(deepClone, sourceParentId!)!.children!;
            const targetList = targetParentId === 'root' ? deepClone : findFieldRecursive(deepClone, targetParentId!)!.children!;
            
            const sourceIndex = sourceList.findIndex((i: any) => i.id === activeId);
            const [movedItem] = sourceList.splice(sourceIndex, 1);
            
            const targetIndex = targetList.findIndex((i: any) => i.id === overId);
            targetList.splice(targetIndex, 0, movedItem);
             
             return deepClone;
        });
    };

    const handleFieldUpdate = (id: string, updates: Partial<FormField>) => {
        if (isReadOnly) return;
        if (updates.id && updates.id !== id) {
            const allFields = getAllFieldsFlattened(fields);
            if (allFields.some(f => f.id === updates.id)) {
                toast.error('このフィールドIDは既に使用されています');
                return;
            }
        }
        setFields(prev => updateFieldRecursive(prev, id, updates));
        if (updates.id && id === selectedFieldId) setSelectedFieldId(updates.id);
    };

    const handleDelete = (id: string) => {
        if (isReadOnly) return;
        setFields(prev => deleteFieldRecursive(prev, id));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

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
                    options: field.options,
                    includeTime: field.includeTime,
                    align: field.align,
                    'x-type': field.type,
                    'x-parent': parentId,
                    default: field.defaultValue, 
                    multiple: field.multiple,
                    maxFiles: field.maxFiles,
                    maxSize: field.maxSize,
                    acceptedTypes: field.acceptedTypes,
                    pattern: field.pattern,
                    items: field.type === 'array' ? {
                        type: 'object',
                        properties: (field.columns || []).reduce((acc: any, col: any) => {
                            acc[col.key || col.id] = { type: col.type, title: col.label };
                            return acc;
                        }, {})
                    } : undefined,
                    formula: field.formula,
                };
                
                if (field.required) required.push(field.id);

                layout.push({ i: field.id, x: 0, y: layout.length * 2, w: field.width || 12, h: 2 });

                if (field.children) processFields(field.children, field.id);
            });
        };

        processFields(fields);

        return {
            schema: { type: 'object', properties, required, 'x-layout': layout },
            layout: layout
        };
    };

    const handleSave = () => {
        if (isReadOnly) return;
        if (!appDef) {
            toast.error('アプリケーション定義が読み込まれていません');
            return;
        }
        const { schema } = generatePreviewSchema();
        saveMutation.mutate({ schema });
    };

    const selectedField = selectedFieldId ? findFieldRecursive(fields, selectedFieldId) || null : null;
    const previewData = isPreviewMode ? generatePreviewSchema() : null;

    if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col bg-background">
                <header className="h-14 border-b flex items-center justify-between px-4 bg-background z-20">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-lg">フォームエディタ</h2>
                        {appDef && <span className="text-sm text-muted-foreground ml-2">- {appDef.appName} {isReadOnly && '(読取専用)'}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant={isPreviewMode ? "outline" : "default"} size="sm" onClick={() => setIsPreviewMode(!isPreviewMode)} className="gap-2">
                            {isPreviewMode ? <Edit3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {isPreviewMode ? '編集に戻る' : 'プレビュー'}
                        </Button>
                        {!isReadOnly && (
                            <Button size="sm" className="gap-2" disabled={isPreviewMode || saveMutation.isPending} onClick={handleSave}>
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
                                    toast.message('フォーム出力結果', {
                                        description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 overflow-auto text-xs text-white">{JSON.stringify(data, null, 2)}</pre>,
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
                        {!isReadOnly && (
                            <div className="w-64 border-r bg-muted/10 flex flex-col">
                                <div className="p-4 border-b font-semibold text-sm">コンポーネント</div>
                                <div className="flex-1 overflow-auto p-4"><FormEditorToolbox /></div>
                            </div>
                        )}
                        <FormEditorCanvas 
                            fields={fields} 
                            selectedFieldId={selectedFieldId} 
                            onSelect={setSelectedFieldId}
                            onDelete={handleDelete}
                            onUpdate={handleFieldUpdate}
                            isReadOnly={isReadOnly}
                        />
                        <div className="w-80 border-l bg-background flex flex-col overflow-y-auto">
                            <FormEditorProperties field={selectedField} onUpdate={handleFieldUpdate} readOnly={isReadOnly} />
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
