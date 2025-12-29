'use client';

import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from '@mui/material/styles';
import ThemeRegistry from './ThemeRegistry';

const theme = createTheme({
    palette: {
        mode: 'light',
    },
});

export default function ThemeRegistryProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeRegistry>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeRegistry>
    );
}
