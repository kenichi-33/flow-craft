export interface Option {
    label: string;
    value: string;
}

export interface RuleCondition {
    fieldId: string;
    operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'empty' | 'not_empty' | 'gt' | 'lt' | 'gte' | 'lte';
    value?: any;
    valueType?: 'const' | 'field';
}

export interface ValidationRule {
    id: string;
    targetFieldId: string; // Target field to apply validation to
    type: 'required' | 'constraint';
    conditions: RuleCondition[];
    logic: 'AND' | 'OR';
    message: string;
    severity: 'error' | 'warning';
    applyToTasks?: string[]; // List of Task/Step IDs. Empty = All
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
    descriptionTop?: string;
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
    // Enhancements
    height?: number;
    rows?: number;
    autoResize?: boolean;
    // Master Lookup
    connectorId?: string;
    binding?: Record<string, string>; // { [metadataKey]: fieldId }
}
