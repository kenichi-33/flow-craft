import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from 'lucide-react';
import type { FormField } from '../types';
import { ConnectorSelectionDialog } from '../dialogs/ConnectorSelectionDialog';

export function MasterConnectorSettings({ 
    field, 
    fields, 
    onUpdate, 
    readOnly 
}: { 
    field: FormField; 
    fields: FormField[]; 
    onUpdate: (id: string, updates: Partial<FormField>) => void; 
    readOnly?: boolean;
}) {
    const { data: connectors } = useQuery({
        queryKey: ['master-connectors-list'],
        queryFn: async () => {
            return api.get<any[]>('/master-connectors');
        },
        staleTime: 5 * 60 * 1000, // cache for 5 min
    });

    const selectedConnector = connectors?.find(c => c.id === field.connectorId);
    // Extract metadata keys from mapping
    const metadataKeys = selectedConnector?.mapping?.metadata 
        ? Object.keys(selectedConnector.mapping.metadata) 
        : [];

    // Filter fields that can be target for binding (exclude self and strict layout items)
    const targetFields = fields.filter(f => 
        f.id !== field.id && 
        !['group', 'divider', 'label', 'section', 'spacer', 'richText', 'array', 'calculation'].includes(f.type)
    );

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs">参照先マスター</Label>
                <ConnectorSelectionDialog 
                    selectedId={field.connectorId} 
                    connectors={connectors || []} 
                    onSelect={(id) => onUpdate(field.id, { connectorId: id })} 
                    disabled={readOnly}
                />
            </div>

            {selectedConnector && metadataKeys.length > 0 && (
                <div className="space-y-2">
                     <Label className="text-xs">データバインディング (自動転記)</Label>
                     <p className="text-[10px] text-muted-foreground">
                         選択時にマスターのデータを他のフィールドに自動入力します。
                     </p>
                     
                     <div className="border rounded bg-muted/10 p-2 space-y-2">
                        {metadataKeys.map((metaKey) => {
                            const currentTarget = field.binding?.[metaKey];
                            return (
                                <div key={metaKey} className="flex items-center gap-2">
                                     <div className="flex-1 text-[10px] font-mono text-muted-foreground truncate" title={metaKey}>
                                         {metaKey}
                                     </div>
                                     <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                     <div className="w-32">
                                         <Select 
                                            value={currentTarget || 'none'} 
                                            onValueChange={(val) => {
                                                const newBinding = { ...(field.binding || {}) };
                                                if (val === 'none') {
                                                    delete newBinding[metaKey];
                                                } else {
                                                    newBinding[metaKey] = val;
                                                }
                                                onUpdate(field.id, { binding: newBinding });
                                            }}
                                            disabled={readOnly}
                                        >
                                            <SelectTrigger className="h-6 text-[10px] px-2">
                                                <SelectValue placeholder="転記先なし" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-[10px] text-muted-foreground">(転記しない)</SelectItem>
                                                {targetFields.map((f) => (
                                                    <SelectItem key={f.id} value={f.id} className="text-[10px]">
                                                        {f.label} ({f.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                     </div>
                                </div>
                            );
                        })}
                     </div>
                </div>
            )}
        </div>
    );
}
