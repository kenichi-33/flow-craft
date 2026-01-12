'use client';

import React from 'react';
import {
    TextField, Paper, Typography, MenuItem, Radio, RadioGroup, FormControl, FormControlLabel, Checkbox, 
    IconButton, Divider, Box, Chip
} from '@mui/material';
import TextIcon from '@mui/icons-material/Notes';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import NumbersIcon from '@mui/icons-material/Numbers';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ListIcon from '@mui/icons-material/List';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import TitleIcon from '@mui/icons-material/Title';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DeleteIcon from '@mui/icons-material/Delete';

// Custom styled components
const inputStyle = {
    '& .MuiInputBase-root': {
        bgcolor: '#f8f9fa',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        transition: 'all 0.2s',
        pointerEvents: 'none' as const // Disable interaction in designer
    },
    '& .MuiInputBase-input': { padding: '10px 14px' }
};

interface Option {
    label: string;
    value: string;
}

interface FormField {
    id: string;
    type: string;
    label: string;
    options?: Option[] | string[];
    required?: boolean;
    readOnly?: boolean;
    includeTime?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'center' | 'bottom';
}

const TOOLBOX_ITEMS = [
    { type: 'text', label: 'テキスト', icon: <TextFieldsIcon /> },
    { type: 'textarea', label: 'テキストエリア', icon: <TextIcon /> },
    { type: 'number', label: '数値', icon: <NumbersIcon /> },
    { type: 'select', label: 'セレクト', icon: <ListIcon /> },
    { type: 'radio', label: 'ラジオ', icon: <RadioButtonCheckedIcon /> },
    { type: 'checkbox', label: 'チェックボックス', icon: <CheckBoxIcon /> },
    { type: 'date', label: '日付', icon: <CalendarTodayIcon /> },
    { type: 'group', label: 'グループ', icon: <AccountTreeIcon /> },
    { type: 'divider', label: '区切り線', icon: <HorizontalRuleIcon /> },
    { type: 'label', label: '見出し', icon: <TitleIcon /> },
];

interface FieldPreviewProps {
    field: FormField;
    isSelected?: boolean;
    onClick?: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    readOnly?: boolean; // For inspection view, maybe we don't show
}

export default function FieldPreview({ field, isSelected, onClick, onDelete, readOnly = false }: FieldPreviewProps) {
    // Helper to get icon based on type (recreated from TOOLBOX_ITEMS)
    const getIcon = () => {
        switch (field.type) {
            case 'text': return <TextFieldsIcon />;
            case 'textarea': return <TextIcon />;
            case 'number': return <NumbersIcon />;
            case 'select': return <ListIcon />;
            case 'radio': return <RadioButtonCheckedIcon />;
            case 'checkbox': return <CheckBoxIcon />;
            case 'date': return <CalendarTodayIcon />;
            case 'group': return <AccountTreeIcon />;
            case 'divider': return <HorizontalRuleIcon />;
            case 'label': return <TitleIcon />;
            default: return <TextIcon />;
        }
    };

    const renderPreview = () => {
        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
                return (
                    <TextField
                        fullWidth
                        disabled
                        variant="standard"
                        size="small"
                        placeholder={field.type === 'date' && field.includeTime ? 'YYYY/MM/DD HH:mm' : (field.label || 'テキスト')}
                        InputProps={{ disableUnderline: true }}
                        sx={inputStyle}
                    />
                );
            case 'textarea':
                return (
                    <TextField
                        fullWidth
                        disabled
                        variant="standard"
                        multiline
                        rows={2}
                        placeholder={field.label || 'テキストエリア'}
                        InputProps={{ disableUnderline: true }}
                        sx={inputStyle}
                    />
                );
            case 'select':
                return (
                    <TextField select fullWidth disabled size="small" value="" sx={{ bgcolor: '#f8f9fa' }} variant="standard" InputProps={{ disableUnderline: true }}>
                        {field.options && (field.options as any[]).map((opt: any, i: number) => {
                             const label = typeof opt === 'string' ? opt : opt.label;
                             const val = typeof opt === 'string' ? opt : opt.value;
                             return <MenuItem key={i} value={val}>{label}</MenuItem>;
                        })}
                        {(!field.options || field.options.length === 0) && <MenuItem disabled>選択肢を追加してください</MenuItem>}
                    </TextField>
                );
            case 'radio':
                return (
                    <FormControl component="fieldset">
                        <RadioGroup row sx={{ gap: 1 }}>
                            {field.options && (field.options as any[]).map((opt: any, i: number) => {
                                const label = typeof opt === 'string' ? opt : opt.label;
                                return (
                                    <FormControlLabel 
                                        key={i} 
                                        value={typeof opt === 'string' ? opt : opt.value} 
                                        control={<Radio size="small" disabled />} 
                                        label={<Typography variant="body2">{label}</Typography>} 
                                    />
                                );
                            })}
                            {(!field.options || field.options.length === 0) && <Typography variant="caption" color="text.secondary">選択肢を追加してください</Typography>}
                        </RadioGroup>
                    </FormControl>
                );
            case 'checkbox':
                return (
                    <FormControl component="fieldset">
                         <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {field.options && (field.options as any[]).map((opt: any, i: number) => {
                                const label = typeof opt === 'string' ? opt : opt.label;
                                return (
                                    <FormControlLabel 
                                        key={i} 
                                        control={<Checkbox size="small" disabled />} 
                                        label={<Typography variant="body2">{label}</Typography>} 
                                    />
                                );
                            })}
                            {(!field.options || field.options.length === 0) && <Typography variant="caption" color="text.secondary">選択肢を追加してください</Typography>}
                        </Box>
                    </FormControl>
                );
            default:
                return null;
        }
    };

    // Label component override
    if (field.type === 'label') {
        return (
            <Paper
                elevation={0}
                onClick={onClick}
                sx={{
                    p: 1,
                    height: '100%',
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    border: isSelected ? '2px solid' : '1px dashed transparent',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: (field as any).verticalAlign === 'top' ? 'flex-start' : (field as any).verticalAlign === 'bottom' ? 'flex-end' : 'center',
                    justifyContent: (field as any).textAlign === 'center' ? 'center' : (field as any).textAlign === 'right' ? 'flex-end' : 'flex-start',
                    position: 'relative',
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover': onClick ? { border: '1px dashed #ccc' } : {}
                }}
            >
                 <Typography variant="h6" sx={{ fontWeight: 'bold', width: '100%', textAlign: (field as any).textAlign || 'left' }}>
                     {field.label || '見出し'}
                 </Typography>
                 
                 {isSelected && !readOnly && onDelete && (
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        sx={{
                            position: 'absolute',
                            right: 0,
                            top: -10,
                            bgcolor: 'white',
                            border: '1px solid #ddd',
                             '&:hover': { bgcolor: 'error.50', color: 'error.main' }
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                 )}
            </Paper>
        );
    }

    if (field.type === 'divider') {
        return (
            <Paper
                elevation={0}
                onClick={onClick}
                sx={{
                    p: 1,
                    height: '100%',
                    bgcolor: isSelected ? 'action.selected' : 'transparent',
                    border: isSelected ? '2px solid' : '1px dashed #ccc',
                    borderColor: isSelected ? 'primary.main' : '#ccc',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover .actions': { opacity: 1 }
                }}
            >
                <Box sx={{ width: '100%' }}><Divider sx={{ borderColor: '#333', borderBottomWidth: 2 }} /></Box>
                 {isSelected && !readOnly && onDelete && (
                    <Box className="actions" sx={{ position: 'absolute', right: 8, top: -12, bgcolor: 'white', border: '1px solid #ddd', borderRadius: 4, display: 'flex' }}>
                        <IconButton size="small" onClick={onDelete} color="error"><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                 )}
            </Paper>
        );
    }

    if (field.type === 'group') {
        return (
            <Paper
                elevation={0}
                onClick={onClick}
                sx={{
                    p: 0,
                    height: '100%',
                    bgcolor: isSelected ? '#e8f4fc' : '#f8fafc',
                    border: isSelected ? '2px solid' : '2px dashed',
                    borderColor: isSelected ? 'primary.main' : '#90caf9',
                    borderRadius: 2,
                    position: 'relative',
                    cursor: onClick ? 'pointer' : 'default',
                    overflow: 'hidden',
                    '&:hover': onClick ? {
                        borderColor: isSelected ? 'primary.main' : 'primary.light',
                    } : {},
                }}
            >
                {/* Group Header */}
                <Box sx={{ 
                    bgcolor: '#e3f2fd', 
                    px: 2, 
                    py: 1, 
                    borderBottom: '1px solid #90caf9',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1 
                }}>
                    <AccountTreeIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {field.label || 'セクション'}
                    </Typography>
                </Box>
                
                {/* Group Content Area */}
                <Box sx={{ 
                    p: 2, 
                    minHeight: 60, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.5)'
                }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        このセクション以降のフィールドがグループ化されます
                    </Typography>
                </Box>

                 {isSelected && !readOnly && onDelete && (
                    <IconButton
                        size="small"
                        onClick={onDelete}
                        sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'white',
                            border: '1px solid #ddd',
                            '&:hover': { bgcolor: 'error.50', color: 'error.main' }
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                 )}
            </Paper>
        );
    }

    // Default Case (Text, Number, etc.) - Matched exactly to original design
    return (
        <Paper
            elevation={0}
            onClick={onClick}
            sx={{
                p: 1.5,
                height: '100%',
                bgcolor: 'white',
                border: isSelected ? '2px solid' : '1px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.1s',
                display: 'flex',
                flexDirection: 'column',
                cursor: onClick ? 'pointer' : 'default',
                boxShadow: isSelected ? '0 0 0 4px rgba(25, 118, 210, 0.1)' : 'none',
                '&:hover': onClick ? {
                    borderColor: isSelected ? 'primary.main' : 'primary.light',
                } : {},
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ color: isSelected ? 'primary.main' : 'text.secondary', display: 'flex' }}>
                    {React.cloneElement(getIcon() as any, { fontSize: 'small' })}
                </Box>
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{field.label}</Typography>
                {field.required && <Chip label="必須" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem' }} />}
            </Box>

            <Box sx={{ flex: 1, opacity: 0.8 }}>
                {renderPreview()}
            </Box>

            {isSelected && !readOnly && onDelete && (
                <IconButton
                    size="small"
                    onClick={onDelete}
                    sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'error.50',
                        color: 'error.main',
                        '&:hover': { bgcolor: 'error.100' }
                    }}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            )}
        </Paper>
    );
}
