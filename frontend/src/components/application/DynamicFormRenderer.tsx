'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Box, Button, TextField, Checkbox, FormControlLabel, Typography, Paper, MenuItem, Radio, RadioGroup, FormControl, FormLabel, Divider, Chip } from '@mui/material';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';


interface DynamicFormRendererProps {
    schema: any;
    layouts?: any;
    onSubmit?: (data: any) => void;
    renderActions?: (methods: any) => React.ReactNode;
    readOnly?: boolean;
    initialData?: any;
}

// ... styles remain same ...

// Custom styled components for consistent premium look
const itemAnimation = {
    animation: 'fadeInUp 0.5s ease-out forwards',
    opacity: 0,
    '@keyframes fadeInUp': {
        '0%': { opacity: 0, transform: 'translateY(10px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
    }
};

const inputStyle = {
    '& .MuiInputBase-root': {
        bgcolor: '#f8f9fa',
        borderRadius: 3,
        border: '1px solid #e2e8f0',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
            bgcolor: '#fff',
            borderColor: '#bkc',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        },
        '&.Mui-focused': {
            bgcolor: '#fff',
            borderColor: '#3a1c71',
            boxShadow: '0 0 0 3px rgba(58, 28, 113, 0.1)',
        }
    },
    '& .MuiInputBase-input': {
        padding: '12px 16px',
    },
    '& .MuiInputLabel-root': {
        transform: 'translate(14px, 12px) scale(1)',
        '&.Mui-focused, &.MuiFormLabel-filled': {
            transform: 'translate(14px, -9px) scale(0.75)',
            fontWeight: 'bold',
            color: '#3a1c71',
        }
    }
};

const selectionCardStyle = {
    flex: 1,
    minWidth: '150px',
    m: 0.5,
    p: 1.5,
    borderRadius: 3,
    border: '1px solid #edf2f7',
    transition: 'all 0.2s',
    bgcolor: '#f8f9fa',
    '&:hover': {
        bgcolor: '#fff',
        borderColor: '#cbd5e0',
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    },
    '&:has(.Mui-checked)': {
        bgcolor: '#f0f5ff',
        borderColor: '#3a1c71',
        boxShadow: '0 4px 12px rgba(58, 28, 113, 0.1)'
    }
};

export default function DynamicFormRenderer({ schema, layouts, onSubmit, renderActions, readOnly = false, initialData = {} }: DynamicFormRendererProps) {
    const methods = useForm({
        defaultValues: initialData
    });
    const { register, handleSubmit, formState: { errors }, getValues } = methods;
    const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 800 });

    if (!schema || !schema.properties) {
        return <Typography>Invalid Form Schema</Typography>;
    }

    const fields = Object.entries(schema.properties).map(([id, config]: [string, any]) => ({
        id,
        ...config,
    }));

    // Retrieve layout from props.layouts, schema, or generate default
    const propsLayout = layouts?.lg || layouts?.[Object.keys(layouts || {})[0]];
    const schemaLayout = schema['x-layout'];
    const layout = propsLayout || schemaLayout || fields.map((f, i) => ({ i: f.id, x: 0, y: i * 2, w: 12, h: 2 }));
    const effectiveLayouts = layouts || { lg: layout, md: layout, sm: layout, xs: layout, xxs: layout };

    // Sort fields by layout position (y then x) for correct tab order and rendering
    const sortedFields = [...fields].sort((a, b) => {
        const layoutA = layout.find((l: any) => l.i === a.id) || { x: 0, y: 0 };
        const layoutB = layout.find((l: any) => l.i === b.id) || { x: 0, y: 0 };
        if (layoutA.y !== layoutB.y) return layoutA.y - layoutB.y;
        return layoutA.x - layoutB.x;
    });

    const handleFormSubmit = (data: any) => {
        if (onSubmit) {
            onSubmit(data);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <Paper 
                elevation={0}
                sx={{ 
                    p: 5, 
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(30px)',
                    boxShadow: '0 20px 60px 0 rgba(31, 38, 135, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                }}
            >


                <div ref={containerRef}>
                    {mounted && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {(() => {
                                // Group fields into sections
                                const sections: any[] = [];
                                let currentSection: any = { type: 'default', fields: [] };

                                sortedFields.forEach(field => {
                                    if (field.type === 'group') {
                                        if (currentSection.fields.length > 0) {
                                            sections.push(currentSection);
                                        }
                                        currentSection = { type: 'group', title: field.title || field.label, fields: [] };
                                    } else {
                                        currentSection.fields.push(field);
                                    }
                                });
                                if (currentSection.fields.length > 0 || currentSection.type === 'group') {
                                    sections.push(currentSection);
                                }

                                return sections.map((section, secIndex) => (
                                    <Paper 
                                        key={secIndex} 
                                        elevation={section.type === 'group' ? 1 : 0} 
                                        sx={{ 
                                            mb: 3, 
                                            p: section.type === 'group' ? 3 : 0, 
                                            bgcolor: section.type === 'group' ? 'rgba(255,255,255,0.6)' : 'transparent', 
                                            borderRadius: 4,
                                            border: section.type === 'group' ? '1px solid rgba(255,255,255,0.8)' : 'none'
                                        }}
                                    >
                                        {section.type === 'group' && (
                                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1a365d' }}>
                                                {section.title}
                                            </Typography>
                                        )}
                                        
                                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
                                            {section.fields.map((field: any, index: number) => {
                                                const isReadOnly = readOnly || field.readOnly;
                                                // Check required status
                                                const isRequired = !readOnly && (field.required === true || (schema.required && schema.required.includes(field.id)));
                                                
                                                // Calculate grid span and position from layout
                                                // Try to find layout for current field
                                                let span = 12;
                                                let xPos = 0;
                                                let rowHeight = 2; // default rows
                                                if (effectiveLayouts && effectiveLayouts.lg) {
                                                    const l = effectiveLayouts.lg.find((l: any) => l.i === field.id);
                                                    if (l) {
                                                        span = l.w;
                                                        xPos = l.x || 0;
                                                        rowHeight = l.h || 2;
                                                    }
                                                }
                                                // Calculate actual height (each row ~ 80px based on designer rowHeight)
                                                const itemHeight = rowHeight * 80;
                                                
                                                // gridColumn: start / span width
                                                // CSS Grid columns are 1-indexed, so add 1 to xPos
                                                const gridColumnValue = xPos > 0 ? `${xPos + 1} / span ${span}` : `span ${span}`;
                                                
                                                return (
                                                    <Box 
                                                        key={field.id} 
                                                        sx={{ 
                                                            gridColumn: gridColumnValue,
                                                            minHeight: itemHeight,
                                                            ...itemAnimation,
                                                            animationDelay: `${index * 0.05}s`,
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                        }}
                                                    >
                                                        {/* Divider */}
                                                        {field.type === 'divider' && <Divider sx={{ my: 1 }} />}

                                                        {/* Label (Heading) */}
                                                        {field.type === 'label' && (
                                                            <Box sx={{ 
                                                                display: 'flex', 
                                                                alignItems: field.verticalAlign === 'top' ? 'flex-start' : field.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                                                                justifyContent: field.textAlign === 'center' ? 'center' : field.textAlign === 'right' ? 'flex-end' : 'flex-start',
                                                                height: '100%',
                                                                minHeight: 50,
                                                            }}>
                                                                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a365d' }}>
                                                                    {field.title || field.label}
                                                                </Typography>
                                                            </Box>
                                                        )}

                                                        {/* Inputs */}
                                                        {/* Text/Number/Date/TextArea */}
                                                        {(['text', 'number', 'textarea', 'date'].includes(field.type)) && (
                                                            <TextField
                                                                fullWidth
                                                                variant="standard"
                                                                multiline={field.type === 'textarea'}
                                                                rows={field.type === 'textarea' ? 4 : 1}
                                                                type={field.type === 'date' ? (field.includeTime ? 'datetime-local' : 'date') : field.type}
                                                                label={field.title}
                                                                InputLabelProps={{ shrink: true, required: isRequired }}
                                                                {...register(field.id, { required: isRequired })}
                                                                error={!!errors[field.id]}
                                                                helperText={errors[field.id] ? '必須項目です' : ''}
                                                                InputProps={{ 
                                                                    disableUnderline: true,
                                                                    readOnly: isReadOnly,
                                                                }}
                                                                disabled={isReadOnly}
                                                                sx={inputStyle}
                                                            />
                                                        )}

                                                        {/* Select */}
                                                        {field.type === 'select' && (
                                                            <TextField
                                                                select
                                                                fullWidth
                                                                variant="standard"
                                                                label={field.title}
                                                                InputLabelProps={{ shrink: true, required: isRequired }}
                                                                {...register(field.id, { required: isRequired })}
                                                                error={!!errors[field.id]}
                                                                defaultValue=""
                                                                InputProps={{ disableUnderline: true, readOnly: isReadOnly }}
                                                                disabled={isReadOnly}
                                                                sx={inputStyle}
                                                            >
                                                                {field.options?.map((opt: any) => {
                                                                    const val = typeof opt === 'string' ? opt : opt.value;
                                                                    const lbl = typeof opt === 'string' ? opt : opt.label;
                                                                    return (
                                                                        <MenuItem key={val} value={val} sx={{ borderRadius: 2, m: 0.5 }}>
                                                                            {lbl}
                                                                        </MenuItem>
                                                                    );
                                                                })}
                                                            </TextField>
                                                        )}

                                                        {/* Radio Group */}
                                                        {field.type === 'radio' && (
                                                            <FormControl component="fieldset" error={!!errors[field.id]} fullWidth disabled={isReadOnly}>
                                                                <FormLabel component="legend" required={isRequired} sx={{ mb: 1.5, fontWeight: 'bold', fontSize: '0.9rem', color: '#4a5568' }}>{field.title}</FormLabel>
                                                                <RadioGroup row sx={{ display: 'flex', flexWrap: 'wrap', mx: -0.5 }}>
                                                                    {field.options?.map((opt: any) => {
                                                                        const val = typeof opt === 'string' ? opt : opt.value;
                                                                        const lbl = typeof opt === 'string' ? opt : opt.label;
                                                                        return (
                                                                            <FormControlLabel
                                                                                key={val}
                                                                                value={val}
                                                                                control={<Radio {...register(field.id, { required: isRequired })} sx={{ '&.Mui-checked': { color: '#3a1c71' } }} />}
                                                                                label={lbl}
                                                                                sx={selectionCardStyle}
                                                                            />
                                                                        );
                                                                    })}
                                                                </RadioGroup>
                                                            </FormControl>
                                                        )}

                                                        {/* Checkbox Group */}
                                                        {field.type === 'checkbox' && (
                                                            <FormControl component="fieldset" error={!!errors[field.id]} fullWidth disabled={isReadOnly}>
                                                                <FormLabel component="legend" required={isRequired} sx={{ mb: 1.5, fontWeight: 'bold', fontSize: '0.9rem', color: '#4a5568' }}>{field.title}</FormLabel>
                                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -0.5 }}>
                                                                    {/* For checkboxes in RHF, if multiple have same name, they are an array. But simple binding needs care.
                                                                        We'll iterate options and just register independently for now, expecting RHF to handle array if same name. 
                                                                        OR using Controller is safer. But sticking to register for simplicity if it works. 
                                                                        If standard register check is buggy for array, we might need a better solution. 
                                                                        For now, mapped checkboxes with value and same name usually work in HTML forms. */}
                                                                    {field.options && field.options.length > 0 ? (
                                                                        field.options.map((opt: any) => {
                                                                            const val = typeof opt === 'string' ? opt : opt.value;
                                                                            const lbl = typeof opt === 'string' ? opt : opt.label;
                                                                            return (
                                                                                <FormControlLabel
                                                                                    key={val}
                                                                                    control={
                                                                                        <Checkbox 
                                                                                            value={val} 
                                                                                            {...register(field.id)}
                                                                                            sx={{ '&.Mui-checked': { color: '#3a1c71' } }}
                                                                                        />
                                                                                    }
                                                                                    label={lbl}
                                                                                    sx={selectionCardStyle}
                                                                                />
                                                                            );
                                                                        })
                                                                    ) : (
                                                                         <FormControlLabel
                                                                            control={
                                                                                <Checkbox 
                                                                                    {...register(field.id, { required: isRequired })}
                                                                                    sx={{ '&.Mui-checked': { color: '#3a1c71' } }}
                                                                                />
                                                                            }
                                                                            label={field.title || field.label}
                                                                            sx={selectionCardStyle}
                                                                        />
                                                                    )}
                                                                </Box>
                                                            </FormControl>
                                                        )}
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    </Paper>
                                ));
                            })()}
                        </Box>
                    )}
                </div>

                <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
                    {renderActions ? renderActions(methods) : (!readOnly && (
                        <Button 
                            type="submit" 
                            variant="contained" 
                            size="large"
                            sx={{
                                px: 8,
                                py: 2,
                                borderRadius: 50,
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                textTransform: 'none',
                                background: 'linear-gradient(45deg, #3a1c71 30%, #d76d77 90%)',
                                boxShadow: '0 10px 30px rgba(58, 28, 113, 0.3)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    transform: 'translateY(-3px) scale(1.02)',
                                    boxShadow: '0 20px 40px rgba(58, 28, 113, 0.4)',
                                },
                                '&:active': {
                                    transform: 'translateY(-1px)',
                                }
                            }}
                        >
                            Submit Application
                        </Button>
                    ))}
                </Box>
            </Paper>
        </form>
    );
}
