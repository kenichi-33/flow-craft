// DesignerSearchPage - Converted from MUI to shadcn/ui
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { UserDisplay } from '@/components/common/UserDisplay';
import { DynamicSearchForm, type SearchCriterion } from '@/components/model/form/search/DynamicSearchForm';

import { useDebounce } from '@/hooks/useDebounce';

// --- Types ---
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

const NON_INPUT_TYPES = ['label', 'group', 'divider', 'spacer', 'paragraph', 'html', 'button', 'section'];

// --- Main Page ---
export default function DesignerSearchPage() {
    const { id } = useParams();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebounce(keyword, 500); 
    const [filterCriteria, setFilterCriteria] = useState<Record<string, SearchCriterion>>({}); // Draft filters
    
    // Automatically update searchParams when debouncedKeyword or filterCriteria changes
    const [searchParams, setSearchParams] = useState<{ keyword: string; criteria: Record<string, SearchCriterion> | undefined }>({ keyword: '', criteria: undefined });

    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Sync search params with debounced input
    React.useEffect(() => {
        setSearchParams({ 
            keyword: debouncedKeyword, 
            criteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : undefined 
        });
        setPage(0);
    }, [debouncedKeyword, filterCriteria]);

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
        queryKey: ['search-applications', id, page, rowsPerPage, searchParams],
        queryFn: async () => {
            const filters = searchParams.criteria 
                ? Object.entries(searchParams.criteria).map(([key, crit]) => ({
                    field: `inputData.${key}`,
                    operator: crit.operator,
                    value: crit.value
                })) 
                : [];
            
            return api.post('/search/applications', { 
                applicationDefinitionId: id, 
                keyword: searchParams.keyword,
                filters,
                page: page + 1, 
                limit: rowsPerPage 
            });
        },
        enabled: !!id,
        placeholderData: (prev) => prev,
    });

    const handleSearch = () => { 
        // Optional: Manual trigger if needed, but useEffect handles it. 
        // We update the state to ensure consistency or immediate feedback.
        setSearchParams({ keyword, criteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : undefined });
        setPage(0); 
    };

    const toggleRow = (rowId: string) => setExpandedRow(expandedRow === rowId ? null : rowId);

    const handleFilterChange = React.useCallback((c: Record<string, SearchCriterion>) => {
        setFilterCriteria(c);
    }, []);

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

                <Card className="border-0 shadow-sm bg-muted/10 mb-6">
                    <CardContent className="p-4 space-y-4">
                        {/* Hybrid Search Bar */}
                        <div className="flex flex-col md:flex-row gap-4">
                           <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    placeholder="キーワード検索（全文検索）..."
                                    className="pl-10 h-10 text-base"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <Button 
                                variant={showAdvanced ? "secondary" : "outline"} 
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex gap-2 min-w-[140px]"
                            >
                                <Filter className="h-4 w-4" />
                                詳細フィルタ
                                {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                            <Button onClick={() => handleSearch()} disabled={isSearchLoading} className="min-w-[100px]">
                                {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '検索'}
                            </Button>
                        </div>

                        {/* Collapsible Advanced Search */}
                        <Collapsible open={showAdvanced}>
                            <CollapsibleContent className="pt-4 border-t mt-4 border-muted-foreground/20">
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">フィールド指定検索</h3>
                                <DynamicSearchForm 
                                    schema={formDef.schema} 
                                    onChange={handleFilterChange} 
                                />
                            </CollapsibleContent>
                        </Collapsible>
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
