'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Chip, CircularProgress, Alert, MenuItem, FormControl, InputLabel, Select, IconButton, Collapse
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { api } from '@/lib/api';
import { useForm, Controller } from 'react-hook-form';

// --- Interfaces ---

interface SearchCriterion {
  operator: string; // 'equals', 'contains', 'gt', etc.
  value: any;
}

interface SearchApplicationDto {
  applicationDefinitionId: string;
  criteria?: Record<string, SearchCriterion>;
  page?: number;
  limit?: number;
}

interface Application {
  id: string;
  applicationNumber: number;
  status: string;
  applicantId: string;
  createdAt: string;
  inputData: any;
}

interface SearchResult {
  items: Application[];
  total: number;
  page: number;
  limit: number;
}

// --- Dynamic Search Form Component ---

const OPERATORS = [
  { value: 'equals', label: 'Equals (=)' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'gte', label: 'Greater/Equal (>=)' },
  { value: 'lte', label: 'Less/Equal (<=)' },
];

const DynamicSearchForm = ({ schema, onSubmit, isLoading }: { schema: any, onSubmit: (criteria: any) => void, isLoading: boolean }) => {
  const { control, handleSubmit, register, unregister, watch, setValue, getValues } = useForm();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<string>('');

  if (!schema || !schema.properties) return null;

  const allFields = Object.entries(schema.properties).map(([id, config]: [string, any]) => ({
    id,
    ...config,
  }));

  // Available fields to add (not currently active)
  const availableFields = allFields.filter(f => !activeFilters.includes(f.id));

  const handleAddField = () => {
    if (selectedFieldToAdd) {
      setActiveFilters([...activeFilters, selectedFieldToAdd]);
      setSelectedFieldToAdd('');
    }
  };

  const handleRemoveField = (fieldId: string) => {
    setActiveFilters(activeFilters.filter(id => id !== fieldId));
    unregister(`${fieldId}_operator`);
    unregister(`${fieldId}_value`);
  };

  const onFormSubmit = (data: any) => {
    const criteria: Record<string, SearchCriterion> = {};
    
    activeFilters.forEach(fieldId => {
      const field = allFields.find(f => f.id === fieldId);
      if (!field) return;

      const operator = data[`${fieldId}_operator`];
      const value = data[`${fieldId}_value`];
      
      if (value !== undefined && value !== '' && value !== null) {
        criteria[fieldId] = {
          operator: operator || 'equals',
          value: field.type === 'number' ? Number(value) : value
        };
      }
    });

    onSubmit(criteria);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      {/* Active Filters List */}
      <Box sx={{ mb: 3 }}>
        {activeFilters.length === 0 && (
            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', mb: 2 }}>
                検索条件が追加されていません。下のリストから条件を追加してください。
            </Typography>
        )}
        <Grid container spacing={2}>
            {activeFilters.map((fieldId) => {
                const field = allFields.find(f => f.id === fieldId);
                if (!field) return null;

                return (
                <Grid size={{ xs: 12 }} key={fieldId}>
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, position: 'relative' }}>
                        <IconButton 
                            size="small" 
                            onClick={() => handleRemoveField(fieldId)}
                            sx={{ position: 'absolute', top: 8, right: 8 }}
                        >
                            <KeyboardArrowUpIcon sx={{ transform: 'rotate(45deg)' }} /> {/* Close Icon substitute */}
                        </IconButton>
                        
                        <Typography variant="subtitle2" color="textPrimary" gutterBottom sx={{ fontWeight: 'bold' }}>
                            {field.title || field.label || field.id}
                        </Typography>

                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, md: 4 }}>
                                <FormControl fullWidth size="small" variant="standard">
                                    <Select
                                        defaultValue={field.type === 'string' ? "contains" : "equals"}
                                        {...register(`${field.id}_operator`)}
                                        disableUnderline
                                        sx={{ fontSize: '0.875rem' }}
                                    >
                                        {OPERATORS.map(op => (
                                        <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, md: 8 }}>
                                {field.type === 'select' || field.type === 'radio' ? (
                                    <FormControl fullWidth size="small">
                                        <Select
                                            {...register(`${field.id}_value`)}
                                            variant="standard"
                                            disableUnderline
                                            displayEmpty
                                            defaultValue=""
                                        >
                                            <MenuItem value=""><em>Any</em></MenuItem>
                                            {field.options?.map((opt: any) => {
                                                const val = typeof opt === 'string' ? opt : opt.value;
                                                const lbl = typeof opt === 'string' ? opt : opt.label;
                                                return <MenuItem key={val} value={val}>{lbl}</MenuItem>
                                            })}
                                        </Select>
                                    </FormControl>
                                ) : (
                                    <TextField
                                        fullWidth
                                        size="small"
                                        variant="standard"
                                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                        InputLabelProps={{ shrink: true }}
                                        {...register(`${field.id}_value`)}
                                        placeholder="Value..."
                                        InputProps={{ disableUnderline: true }}
                                    />
                                )}
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
                );
            })}
        </Grid>
      </Box>

      {/* Add Filter Section */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
         <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>条件を追加...</InputLabel>
            <Select
                value={selectedFieldToAdd}
                label="条件を追加..."
                onChange={(e) => setSelectedFieldToAdd(e.target.value)}
            >
                {availableFields.map(field => (
                    <MenuItem key={field.id} value={field.id}>
                        {field.title || field.label || field.id}
                    </MenuItem>
                ))}
                {availableFields.length === 0 && <MenuItem disabled>全ての項目を追加済み</MenuItem>}
            </Select>
         </FormControl>
         <Button 
            variant="outlined" 
            onClick={handleAddField}
            disabled={!selectedFieldToAdd}
            startIcon={<FilterListIcon />}
         >
            追加
         </Button>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          type="submit" 
          variant="contained" 
          color="primary" 
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
          disabled={isLoading}
          sx={{ px: 4, borderRadius: 2 }}
        >
          検索
        </Button>
      </Box>
    </form>
  );
};


// --- Main Page Component ---

export default function SearchPage() {
  const params = useParams();
  const id = params?.id as string;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [criteria, setCriteria] = useState<Record<string, SearchCriterion> | undefined>(undefined);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // 1. Fetch Application Definition to get formDefinitionId
  const { data: appDef, isLoading: isAppLoading, error: appError } = useQuery({
    queryKey: ['apps', id],
    queryFn: () => api.get<any>(`/application-definitions/${id}`),
    enabled: !!id,
  });

  // 2. Fetch Form Definition
  const { data: formDef, isLoading: isFormLoading, error: formError } = useQuery({
    queryKey: ['form-definitions', appDef?.formDefinitionId],
    queryFn: () => api.get<any>(`/forms/${appDef.formDefinitionId}`), // Fixed endpoint: /forms/:id based on controller check
    enabled: !!appDef?.formDefinitionId,
  });

  // 3. Search Mutation/Query
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<SearchResult>({
    queryKey: ['search-applications', id, page, rowsPerPage, criteria],
    queryFn: async () => {
       const dto: SearchApplicationDto = {
          applicationDefinitionId: id,
          criteria: criteria,
          page: page + 1,
          limit: rowsPerPage
       };
       return api.post('/search/applications', dto);
    },
    enabled: !!id,
    placeholderData: (previousData) => previousData
  });

  const handleSearch = (newCriteria: any) => {
    setCriteria(newCriteria);
    setPage(0);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const toggleRow = (rowId: string) => {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  }

  if (isAppLoading || isFormLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
  }

  if (appError || formError) {
      console.error("SearchPage Error:", { appError, formError });
      return (
        <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
                Error loading search dependencies.
                {appError && <div>Application Definition Error: {(appError as any).message}</div>}
                {formError && <div>Form Definition Error: {(formError as any).message}</div>}
            </Alert>
        </Box>
      );
  }

  if (!appDef || !formDef) {
      console.warn("Missing defs:", { appDef, formDef });
      return (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
                Application or Form Definition not found.
                {!appDef && <div>Application Definition is missing for ID: {id}</div>}
                {!formDef && <div>Form Definition is missing for ID: {appDef?.formDefinitionId}</div>}
            </Alert>
          </Box>
      );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
       {/* Header */}
       <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
             データ検索: {appDef.name}
          </Typography>
          <Typography variant="body2" color="textSecondary">
             以下のフォームから条件を指定して申請データを検索できます。
          </Typography>
       </Box>

       {/* Search Criteria Card */}
       <Paper sx={{ mb: 4, p: 3, borderRadius: 3 }} elevation={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
             <FilterListIcon color="action" sx={{ mr: 1 }} />
             <Typography variant="h6">検索条件</Typography>
          </Box>
          <DynamicSearchForm 
             schema={formDef.schema} 
             onSubmit={handleSearch} 
             isLoading={isSearchLoading}
          />
       </Paper>

       {/* Results Table */}
       <Paper sx={{ borderRadius: 3, overflow: 'hidden' }} elevation={1}>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell />
                  <TableCell>申請番号</TableCell>
                  <TableCell>ステータス</TableCell>
                  <TableCell>申請者</TableCell>
                  <TableCell>申請日時</TableCell>
                  {/* Dynamic Columns - Show first 3 fields from schema for quick view */}
                  {Object.keys(formDef.schema.properties || {}).slice(0, 3).map(key => (
                      <TableCell key={key}>{formDef.schema.properties[key].title || key}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {searchResults?.items.map((app) => (
                  <React.Fragment key={app.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleRow(app.id)}>
                           {expandedRow === app.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>#{app.applicationNumber}</TableCell>
                      <TableCell>
                        <Chip 
                          label={app.status} 
                          color={app.status === 'APPROVED' ? 'success' : app.status === 'REJECTED' ? 'error' : app.status === 'DRAFT' ? 'default' : 'primary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{app.applicantId}</TableCell>
                      <TableCell>{new Date(app.createdAt).toLocaleString()}</TableCell>
                      
                       {/* Dynamic Data Cells */}
                       {Object.keys(formDef.schema.properties || {}).slice(0, 3).map(key => (
                          <TableCell key={key}>
                             {typeof app.inputData[key] === 'object' ? JSON.stringify(app.inputData[key]) : app.inputData[key]}
                          </TableCell>
                       ))}
                    </TableRow>
                    
                    {/* Expanded Detail Row */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6 + Object.keys(formDef.schema.properties || {}).slice(0, 3).length}>
                        <Collapse in={expandedRow === app.id} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 2, p: 2, bgcolor: '#fafafa', borderRadius: 2 }}>
                             <Typography variant="subtitle2" gutterBottom component="div">
                                詳細データ
                             </Typography>
                             <Grid container spacing={2}>
                                {Object.entries(app.inputData).map(([key, val]: [string, any]) => {
                                   const fieldConfig = formDef.schema.properties?.[key];
                                   const label = fieldConfig?.title || key;
                                   return (
                                     <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                                        <Typography variant="caption" color="textSecondary" display="block">
                                           {label}
                                        </Typography>
                                        <Typography variant="body2">
                                           {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                        </Typography>
                                     </Grid>
                                   );
                                })}
                             </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
                
                {(!searchResults?.items || searchResults.items.length === 0) && !isSearchLoading && (
                   <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                         <Typography color="textSecondary">データが見つかりませんでした</Typography>
                      </TableCell>
                   </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
             rowsPerPageOptions={[10, 25, 50]}
             component="div"
             count={searchResults?.total || 0}
             rowsPerPage={rowsPerPage}
             page={page}
             onPageChange={handleChangePage}
             onRowsPerPageChange={handleChangeRowsPerPage}
          />
       </Paper>
    </Box>
  );
}
