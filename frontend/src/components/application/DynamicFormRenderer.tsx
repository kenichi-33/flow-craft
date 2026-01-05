'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Box, Button, TextField, Checkbox, FormControlLabel, Typography, Paper, MenuItem, Radio, RadioGroup, FormControl, FormLabel } from '@mui/material';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';


interface DynamicFormRendererProps {
    schema: any;
    onSubmit?: (data: any) => void;
    renderActions?: (methods: any) => React.ReactNode;
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

export default function DynamicFormRenderer({ schema, onSubmit, renderActions }: DynamicFormRendererProps) {
    const methods = useForm();
    const { register, handleSubmit, formState: { errors }, getValues } = methods;
    const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 800 });

    if (!schema || !schema.properties) {
        return <Typography>Invalid Form Schema</Typography>;
    }

    const fields = Object.entries(schema.properties).map(([id, config]: [string, any]) => ({
        id,
        ...config,
    }));

    // Retrieve layout from schema or generate default
    const layout = schema['x-layout'] || fields.map((f, i) => ({ i: f.id, x: 0, y: i * 2, w: 12, h: 2 }));
    const layouts = { lg: layout, md: layout, sm: layout, xs: layout, xxs: layout };

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
                        <ResponsiveGridLayout
                            className="layout"
                            layouts={layouts}
                            width={width}
                            breakpoints={{ lg: 1200, md: 800, sm: 600, xs: 480, xxs: 0 }}
                            cols={{ lg: 12, md: 12, sm: 12, xs: 1, xxs: 1 }} 
                            rowHeight={60}
                            dragConfig={{ enabled: false }}
                            resizeConfig={{ enabled: false }}
                            dropConfig={{ enabled: false }}
                            margin={[24, 24]}
                        >
                            {sortedFields.map((field, index) => (
                                <div key={field.id}>
                                    <Box 
                                        sx={{ 
                                            ...itemAnimation,
                                            animationDelay: `${index * 0.05}s`,
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: field.type === 'radio' || field.type === 'checkbox' ? 'flex-start' : 'center'
                                        }}
                                    >
                                        {/* Text Types */}
                                        {(field.type === 'text' || field.type === 'number' || field.type === 'textarea' || field.type === 'date') && (
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                multiline={field.type === 'textarea'}
                                                rows={field.type === 'textarea' ? 4 : 1}
                                                type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                                label={field.title}
                                                InputLabelProps={{ shrink: true }}
                                                {...register(field.id, { required: true })}
                                                error={!!errors[field.id]}
                                                helperText={errors[field.id] ? 'This field is required' : ''}
                                                InputProps={{ disableUnderline: true }}
                                                sx={inputStyle}
                                            />
                                        )}

                                        {/* Select Type */}
                                        {field.type === 'select' && (
                                            <TextField
                                                select
                                                fullWidth
                                                variant="standard"
                                                label={field.title}
                                                InputLabelProps={{ shrink: true }}
                                                {...register(field.id, { required: true })}
                                                error={!!errors[field.id]}
                                                defaultValue=""
                                                InputProps={{ disableUnderline: true }}
                                                sx={inputStyle}
                                            >
                                                {field.options?.map((opt: string) => (
                                                    <MenuItem key={opt} value={opt} sx={{ borderRadius: 2, m: 0.5 }}>
                                                        {opt}
                                                    </MenuItem>
                                                ))}
                                            </TextField>
                                        )}

                                        {/* Radio Group */}
                                        {field.type === 'radio' && (
                                            <FormControl component="fieldset" error={!!errors[field.id]} fullWidth>
                                                <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 'bold', fontSize: '0.9rem', color: '#4a5568' }}>{field.title}</FormLabel>
                                                <RadioGroup row sx={{ display: 'flex', flexWrap: 'wrap', mx: -0.5 }}>
                                                    {field.options?.map((opt: string) => (
                                                        <FormControlLabel
                                                            key={opt}
                                                            value={opt}
                                                            control={<Radio {...register(field.id)} sx={{ '&.Mui-checked': { color: '#3a1c71' } }} />}
                                                            label={opt}
                                                            sx={selectionCardStyle}
                                                        />
                                                    ))}
                                                </RadioGroup>
                                            </FormControl>
                                        )}

                                        {/* Checkbox Group (Assuming single logical grouping or multiple items if array) */}
                                        {field.type === 'checkbox' && (
                                            <Box sx={{ ...selectionCardStyle, display: 'inline-flex', alignItems: 'center', width: 'auto', flex: 'none', pr: 3 }}>
                                                <FormControlLabel
                                                    control={<Checkbox {...register(field.id)} sx={{ '&.Mui-checked': { color: '#3a1c71' } }} />}
                                                    label={<Typography fontWeight="500">{field.title}</Typography>}
                                                    sx={{ m: 0 }}
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                </div>
                            ))}
                        </ResponsiveGridLayout>
                    )}
                </div>

                <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
                    {renderActions ? renderActions(methods) : (
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
                    )}
                </Box>
            </Paper>
        </form>
    );
}
