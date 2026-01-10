// DesignerSearchPage - Converted from MUI to shadcn/ui
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Filter, ChevronDown, ChevronUp, X, Plus } from 'lucide-react';
import { UserDisplay } from '@/components/common/UserDisplay';

// --- Types ---
interface SearchCriterion { operator: string; value: any; }
interface Application {
    id: string;
    applicationNumber: number;
    status: string;
    applicantId: string;
    applicantInfo?: any;
    createdAt: string;
    inputData: any;
}
interface SearchResult { items: Application[]; total: number; page: number; limit: number; }

// --- Helpers ---
const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case 'APPROVED': return 'default';
        case 'IN_PROGRESS': return 'secondary';
        case 'REJECTED': return 'destructive';
        case 'REMANDED': return 'outline';
        default: return 'outline';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'APPROVED': return '承認済';
        case 'IN_PROGRESS': return '処理中';
        case 'REJECTED': return '却下';
        case 'REMANDED': return '差戻し';
        case 'DRAFT': return '下書き';
        default: return status;
    }
};

const OPERATORS = [
    { value: 'equals', label: '等しい (=)' },
    { value: 'contains', label: '含む' },
    { value: 'gt', label: 'より大きい (>)' },
    { value: 'lt', label: 'より小さい (<)' },
    { value: 'gte', label: '以上 (>=)' },
    { value: 'lte', label: '以下 (<=)' },
];

const NON_INPUT_TYPES = ['label', 'group', 'divider', 'spacer', 'paragraph', 'html', 'button'];

// --- Dynamic Search Form ---
function DynamicSearchForm({ schema, onSubmit, isLoading }: { schema: any; onSubmit: (criteria: any) => void; isLoading: boolean }) {
    const { register, handleSubmit, unregister, setValue } = useForm();
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<string>('');

    if (!schema?.properties) return null;

    const allFields = Object.entries(schema.properties)
        .map(([id, config]: [string, any]) => ({ id, ...config }))
        .filter((f) => !NON_INPUT_TYPES.includes(f.type));
    const availableFields = allFields.filter((f) => !activeFilters.includes(f.id));

    const handleAddField = () => {
        if (selectedFieldToAdd) {
            setActiveFilters([...activeFilters, selectedFieldToAdd]);
            setSelectedFieldToAdd('');
        }
    };

    const handleRemoveField = (fieldId: string) => {
        setActiveFilters(activeFilters.filter((id) => id !== fieldId));
        unregister(`${fieldId}_operator`);
        unregister(`${fieldId}_value`);
    };

    const onFormSubmit = (data: any) => {
        const criteria: Record<string, SearchCriterion> = {};
        activeFilters.forEach((fieldId) => {
            const field = allFields.find((f) => f.id === fieldId);
            if (!field) return;
            const operator = data[`${fieldId}_operator`];
            const value = data[`${fieldId}_value`];
            if (value !== undefined && value !== '' && value !== null) {
                criteria[fieldId] = { operator: operator || 'equals', value: field.type === 'number' ? Number(value) : value };
            }
        });
        onSubmit(criteria);
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            {activeFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">検索条件が追加されていません。下のリストから条件を追加してください。</p>
            ) : (
                <div className="space-y-3">
                    {activeFilters.map((fieldId) => {
                        const field = allFields.find((f) => f.id === fieldId);
                        if (!field) return null;
                        return (
                            <Card key={fieldId} className="relative">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => handleRemoveField(fieldId)}>
                                    <X className="h-4 w-4" />
                                </Button>
                                <CardContent className="pt-4 pb-3">
                                    <Label className="font-semibold">{field.title || field.label || field.id}</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                                        <Select defaultValue={field.type === 'string' ? 'contains' : 'equals'} onValueChange={(v) => setValue(`${field.id}_operator`, v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {OPERATORS.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <div className="md:col-span-2">
                                            {['select', 'radio', 'checkbox'].includes(field.type) ? (
                                                    <Select onValueChange={(v) => setValue(`${field.id}_value`, v === '__all__' ? '' : v)}>
                                                    <SelectTrigger><SelectValue placeholder="選択..." /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__all__">Any</SelectItem>
                                                        {field.options?.map((opt: any) => {
                                                            const val = typeof opt === 'string' ? opt : opt.value;
                                                            const lbl = typeof opt === 'string' ? opt : opt.label;
                                                            return <SelectItem key={val} value={val}>{lbl}</SelectItem>;
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} placeholder="値を入力..." {...register(`${field.id}_value`)} />
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add Filter */}
            <div className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                <Select value={selectedFieldToAdd} onValueChange={setSelectedFieldToAdd}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="条件を追加..." /></SelectTrigger>
                    <SelectContent>
                        {availableFields.length === 0 ? (
                            <SelectItem value="__empty__" disabled>全ての項目を追加済み</SelectItem>
                        ) : (
                            availableFields.map((field) => <SelectItem key={field.id} value={field.id}>{field.title || field.label || field.id}</SelectItem>)
                        )}
                    </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleAddField} disabled={!selectedFieldToAdd}>
                    <Plus className="h-4 w-4 mr-1" />追加
                </Button>
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    検索
                </Button>
            </div>
        </form>
    );
}

// --- Main Page ---
export default function DesignerSearchPage() {
    const { id } = useParams();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [criteria, setCriteria] = useState<Record<string, SearchCriterion> | undefined>(undefined);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const { data: appDef, isLoading: isAppLoading, error: appError } = useQuery({
        queryKey: ['apps', id],
        queryFn: () => api.get<any>(`/application-definitions/${id}`),
        enabled: !!id,
    });

    const { data: formDef, isLoading: isFormLoading, error: formError } = useQuery({
        queryKey: ['form-definitions', appDef?.formDefinitionId],
        queryFn: () => api.get<any>(`/forms/${appDef.formDefinitionId}`),
        enabled: !!appDef?.formDefinitionId,
    });

    const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchResult>({
        queryKey: ['search-applications', id, page, rowsPerPage, criteria],
        queryFn: async () => api.post('/search/applications', { applicationDefinitionId: id, criteria, page: page + 1, limit: rowsPerPage }),
        enabled: !!id,
        placeholderData: (prev) => prev,
    });

    const handleSearch = (newCriteria: any) => { setCriteria(newCriteria); setPage(0); };
    const toggleRow = (rowId: string) => setExpandedRow(expandedRow === rowId ? null : rowId);

    const inputFields = formDef?.schema?.properties
        ? Object.entries(formDef.schema.properties).filter(([_, config]: [string, any]) => !NON_INPUT_TYPES.includes(config.type))
        : [];

    if (isAppLoading || isFormLoading) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (appError || formError) return <Alert variant="destructive" className="max-w-2xl mx-auto"><AlertDescription>データの読み込みに失敗しました。</AlertDescription></Alert>;
    if (!appDef || !formDef) return <Alert variant="destructive" className="max-w-2xl mx-auto"><AlertDescription>アプリまたはフォーム定義が見つかりません。</AlertDescription></Alert>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold">データ検索: {appDef.name}</h2>
                <p className="text-muted-foreground">以下のフォームから条件を指定して申請データを検索できます。</p>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5" />検索条件</CardTitle>
                </CardHeader>
                <CardContent>
                    <DynamicSearchForm schema={formDef.schema} onSubmit={handleSearch} isLoading={isSearchLoading} />
                </CardContent>
            </Card>

            <Card>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10" />
                                <TableHead>申請番号</TableHead>
                                <TableHead>ステータス</TableHead>
                                <TableHead>申請者</TableHead>
                                <TableHead>申請日時</TableHead>
                                {inputFields.map(([key, config]: [string, any]) => <TableHead key={key}>{config.title || key}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {searchResults?.items.map((app) => (
                                <React.Fragment key={app.id}>
                                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(app.id)}>
                                        <TableCell><Button variant="ghost" size="icon" className="h-6 w-6">{expandedRow === app.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></TableCell>
                                        <TableCell className="font-semibold">#{app.applicationNumber}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(app.status)}>{getStatusLabel(app.status)}</Badge></TableCell>
                                        <TableCell><UserDisplay user={app.applicantInfo} fallback={app.applicantId} /></TableCell>
                                        <TableCell>{new Date(app.createdAt).toLocaleString('ja-JP')}</TableCell>
                                        {inputFields.map(([key]) => <TableCell key={key}>{typeof app.inputData?.[key] === 'object' ? JSON.stringify(app.inputData[key]) : app.inputData?.[key] ?? '-'}</TableCell>)}
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={5 + inputFields.length} className="p-0">
                                            <Collapsible open={expandedRow === app.id}>
                                                <CollapsibleContent>
                                                    <div className="p-4 bg-muted/30 m-2 rounded-lg">
                                                        <h4 className="font-semibold text-sm mb-2">詳細データ</h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                            {Object.entries(app.inputData || {}).map(([key, val]: [string, any]) => (
                                                                <div key={key}>
                                                                    <p className="text-xs text-muted-foreground">{formDef.schema.properties?.[key]?.title || key}</p>
                                                                    <p className="text-sm">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            ))}
                            {(!searchResults?.items?.length && !isSearchLoading) && (
                                <TableRow><TableCell colSpan={5 + inputFields.length} className="text-center py-8 text-muted-foreground">データが見つかりませんでした</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                    <div className="text-sm text-muted-foreground">全 {searchResults?.total || 0} 件</div>
                    <div className="flex items-center gap-2">
                        <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setPage(0); }}>
                            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground">件</span>
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>前へ</Button>
                        <span className="text-sm">{page + 1} / {Math.ceil((searchResults?.total || 0) / rowsPerPage) || 1}</span>
                        <Button variant="outline" size="sm" disabled={(page + 1) * rowsPerPage >= (searchResults?.total || 0)} onClick={() => setPage(page + 1)}>次へ</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
