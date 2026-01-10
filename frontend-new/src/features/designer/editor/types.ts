export interface Option {
    label: string;
    value: string;
}

export interface FormField {
    id: string;
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
}
