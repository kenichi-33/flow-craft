export interface Option {
    label: string;
    value: string;
}

export interface FormField {
    id: string;
    key?: string; // For Data Grid columns
    type: string;
    label: string;
    options?: Option[] | string[];
    required?: boolean;
    readOnly?: boolean;
    includeTime?: boolean;
    description?: string;
    align?: 'left' | 'center' | 'right';
    width?: number; // 1-12 col span
    defaultValue?: any;
    children?: FormField[]; // For nested groups
    // File-specific properties
    acceptedTypes?: string; // e.g., ".pdf,.jpg,.png"
    maxSize?: number; // Max file size in MB
    multiple?: boolean; // Allow multiple files
    maxFiles?: number; // Max number of files
    // For Data Grid
    columns?: FormField[]; // Simplified nested fields for grid columns. Using FormField itself but will treat ID as Key.
    formula?: string; // For CalculationField
    pattern?: string; // For Regex validation
}
