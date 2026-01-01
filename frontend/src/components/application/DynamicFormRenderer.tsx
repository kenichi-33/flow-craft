'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Box, Button, TextField, Checkbox, FormControlLabel, Typography, Paper, MenuItem, Radio, RadioGroup, FormControl, FormLabel } from '@mui/material';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

interface DynamicFormRendererProps {
    schema: any;
    onSubmit: (data: any) => void;
}

export default function DynamicFormRenderer({ schema, onSubmit }: DynamicFormRendererProps) {
    const { register, handleSubmit, formState: { errors } } = useForm();
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

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <Paper sx={{ p: 3 }}>
                <div ref={containerRef}>
                    {mounted && (
                        <ResponsiveGridLayout
                            className="layout"
                            layouts={layouts}
                            width={width}
                            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                            rowHeight={60}
                            dragConfig={{ enabled: false }}
                            resizeConfig={{ enabled: false }}
                            dropConfig={{ enabled: false }}
                        >
                            {fields.map((field) => (
                                <div key={field.id} style={{ padding: '8px' }}>
                                    {field.type === 'text' && (
                                        <TextField
                                            fullWidth
                                            label={field.title}
                                            {...register(field.id, { required: true })}
                                            error={!!errors[field.id]}
                                            helperText={errors[field.id] ? 'This field is required' : ''}
                                        />
                                    )}

                                    {field.type === 'number' && (
                                        <TextField
                                            fullWidth
                                            type="number"
                                            label={field.title}
                                            {...register(field.id, { required: true })}
                                            error={!!errors[field.id]}
                                        />
                                    )}

                                    {field.type === 'textarea' && (
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            label={field.title}
                                            {...register(field.id, { required: true })}
                                            error={!!errors[field.id]}
                                        />
                                    )}

                                    {field.type === 'select' && (
                                        <TextField
                                            select
                                            fullWidth
                                            label={field.title}
                                            {...register(field.id, { required: true })}
                                            error={!!errors[field.id]}
                                            defaultValue=""
                                        >
                                            {field.options?.map((opt: string) => (
                                                <MenuItem key={opt} value={opt}>
                                                    {opt}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    )}

                                    {field.type === 'radio' && (
                                        <FormControl component="fieldset" error={!!errors[field.id]}>
                                            <FormLabel component="legend">{field.title}</FormLabel>
                                            <RadioGroup row>
                                                {field.options?.map((opt: string) => (
                                                    <FormControlLabel
                                                        key={opt}
                                                        value={opt}
                                                        control={<Radio {...register(field.id)} />}
                                                        label={opt}
                                                    />
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                    )}

                                    {field.type === 'date' && (
                                        <TextField
                                            fullWidth
                                            type="date"
                                            label={field.title}
                                            InputLabelProps={{ shrink: true }}
                                            {...register(field.id, { required: true })}
                                            error={!!errors[field.id]}
                                        />
                                    )}

                                    {field.type === 'checkbox' && (
                                        <FormControlLabel
                                            control={<Checkbox {...register(field.id)} />}
                                            label={field.title}
                                        />
                                    )}
                                </div>
                            ))}
                        </ResponsiveGridLayout>
                    )}
                </div>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="submit" variant="contained" size="large">
                        Submit Application
                    </Button>
                </Box>
            </Paper>
        </form>
    );
}
