import type { FormField } from './types';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const findFieldRecursive = (items: FormField[], id: string): FormField | undefined => {
    for (const item of items) {
        if (item.id === id) return item;
        if (item.children) {
            const found = findFieldRecursive(item.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

export const updateFieldRecursive = (items: FormField[], id: string, updates: Partial<FormField>): FormField[] => {
    return items.map(item => {
        if (item.id === id) {
            return { ...item, ...updates };
        }
        if (item.children) {
            return { ...item, children: updateFieldRecursive(item.children, id, updates) };
        }
        return item;
    });
};

export const deleteFieldRecursive = (items: FormField[], id: string): FormField[] => {
    return items.filter(item => item.id !== id).map(item => {
        if (item.children) {
            return { ...item, children: deleteFieldRecursive(item.children, id) };
        }
        return item;
    });
};

export const getAllFieldsFlattened = (items: FormField[]): FormField[] => {
    let result: FormField[] = [];
    items.forEach(item => {
        result.push(item);
        if (item.children) {
            result = [...result, ...getAllFieldsFlattened(item.children)];
        }
    });
    return result;
};

export const findParentId = (items: FormField[], id: string): string | null => {
    if (items.some(i => i.id === id)) return 'root';
    for (const item of items) {
        if (item.children) {
            if (item.children.some(c => c.id === id)) return item.id;
            const found = findParentId(item.children, id);
            if (found) return found;
        }
    }
    return null;
};
