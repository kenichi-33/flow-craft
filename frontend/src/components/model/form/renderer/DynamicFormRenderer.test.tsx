
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import DynamicFormRenderer from './DynamicFormRenderer';

// Mock UI components that might be hard to test or use ResizeObserver
vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} data-testid="textarea-mock" />
}));
// Mock ResizeObserver
// Mock ResizeObserver
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: any) => open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

describe('DynamicFormRenderer', () => {
    const mockSubmit = vi.fn();
    const basicSchema = {
        properties: {
            name: { type: 'text', title: 'Name', required: true },
            age: { type: 'number', title: 'Age' },
            category: { type: 'select', title: 'Category', options: ['A', 'B'] },
            agree: { type: 'checkbox', title: 'Agree', options: [{label: 'Yes', value: 'yes'}] },
            option: { type: 'radio', title: 'Option', options: [{label: 'Opt1', value: '1'}, {label: 'Opt2', value: '2'}] },
        }
    };

    beforeEach(() => {
        mockSubmit.mockClear();
    });

    it('renders basic fields', () => {
        render(<DynamicFormRenderer schema={basicSchema} onSubmit={mockSubmit} />);
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Age')).toBeInTheDocument();
        expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('handles text input', async () => {
        render(<DynamicFormRenderer schema={basicSchema} onSubmit={mockSubmit} />);
        const input = screen.getByPlaceholderText('Nameを入力...');
        fireEvent.change(input, { target: { value: 'Test Name' } });
        expect(input).toHaveValue('Test Name');
    });

    it('validates required fields', async () => {
        render(<DynamicFormRenderer schema={basicSchema} onSubmit={mockSubmit} />);
        
        // Find submit button (rendered by default action renderer or need to pass renderActions?)
        // The component uses renderActions prop. If not provided, no button? 
        // Wait, the component DOES NOT render a button by default unless renderActions is passed?
        // Let's check the code. 'renderActions' is a prop.
    });
    
    // We need to pass renderActions to submit
    const renderSubmitButton = (methods: any) => (
        <button onClick={methods.handleSubmit(mockSubmit)}>Submit</button>
    );

    it('submits valid data', async () => {
        render(<DynamicFormRenderer schema={basicSchema} onSubmit={mockSubmit} renderActions={renderSubmitButton} />);
        
        fireEvent.change(screen.getByPlaceholderText('Nameを入力...'), { target: { value: 'John' } });
        fireEvent.click(screen.getByText('Submit'));

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalled();
        });
    });

    it('blocks submission on required error', async () => {
        render(<DynamicFormRenderer schema={basicSchema} onSubmit={mockSubmit} renderActions={renderSubmitButton} />);
        
        fireEvent.click(screen.getByText('Submit'));
        
        await waitFor(() => {
             // Expect validation error message
             // Shadcn label shows * for required. React hook form should block.
             expect(mockSubmit).not.toHaveBeenCalled();
             // Assuming default error message logic
             // "この項目は必須です"
             expect(screen.getByText('この項目は必須です')).toBeInTheDocument();
        });
    });

    it('renders read-only mode', () => {
        const data = { name: 'ReadOnly User', age: 30, category: 'A' };
        render(<DynamicFormRenderer schema={basicSchema} initialData={data} readOnly={true} />);
        
        expect(screen.getByText('ReadOnly User')).toBeInTheDocument(); // Displayed as text div
        expect(screen.queryByPlaceholderText('Nameを入力...')).not.toBeInTheDocument();
    });

    it('handles global validation rules (error)', async () => {
        const schemaWithRules = {
            ...basicSchema,
            validationRules: [
                {
                    targetFieldId: 'age',
                    type: 'constraint',
                    severity: 'error',
                    conditions: [{ fieldId: 'age', operator: 'lt', value: 18 }],
                    message: 'Must be 18+'
                }
            ]
        };
        
        render(<DynamicFormRenderer schema={schemaWithRules} onSubmit={mockSubmit} renderActions={renderSubmitButton} />);
        
        fireEvent.change(screen.getByPlaceholderText('Nameを入力...'), { target: { value: 'Kid' } });
        fireEvent.change(screen.getByPlaceholderText('Ageを入力...'), { target: { value: '10' } });
        
        fireEvent.click(screen.getByText('Submit'));
        
        await waitFor(() => {
            expect(mockSubmit).not.toHaveBeenCalled();
            expect(screen.getByText('Must be 18+')).toBeInTheDocument();
        });
    });


});
