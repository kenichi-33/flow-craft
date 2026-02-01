import { describe, it, expect } from 'vitest';
import {
  generateId,
  findFieldRecursive,
  updateFieldRecursive,
  deleteFieldRecursive,
  getAllFieldsFlattened,
  findParentId,
} from './utils';
import type { FormField } from './types';

describe('FormDesigner utils', () => {
  describe('generateId', () => {
    it('should generate a unique id', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('findFieldRecursive', () => {
    const fields: FormField[] = [
      { id: 'f1', type: 'text', label: 'Field 1' },
      {
        id: 'g1',
        type: 'group',
        label: 'Group',
        children: [{ id: 'f2', type: 'text', label: 'Nested' }],
      },
    ];

    it('should find top-level field', () => {
      expect(findFieldRecursive(fields, 'f1')?.id).toBe('f1');
    });

    it('should find nested field', () => {
      expect(findFieldRecursive(fields, 'f2')?.id).toBe('f2');
    });

    it('should return undefined if not found', () => {
      expect(findFieldRecursive(fields, 'notexist')).toBeUndefined();
    });
  });

  describe('updateFieldRecursive', () => {
    const fields: FormField[] = [
      { id: 'f1', type: 'text', label: 'Old' },
    ];

    it('should update field', () => {
      const updated = updateFieldRecursive(fields, 'f1', { label: 'New' });
      expect(updated[0].label).toBe('New');
    });
  });

  describe('deleteFieldRecursive', () => {
    const fields: FormField[] = [
      { id: 'f1', type: 'text', label: 'Field 1' },
      { id: 'f2', type: 'text', label: 'Field 2' },
    ];

    it('should delete field', () => {
      const result = deleteFieldRecursive(fields, 'f1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('f2');
    });
  });

  describe('getAllFieldsFlattened', () => {
    const fields: FormField[] = [
      { id: 'f1', type: 'text', label: 'Field 1' },
      {
        id: 'g1',
        type: 'group',
        label: 'Group',
        children: [{ id: 'f2', type: 'text', label: 'Nested' }],
      },
    ];

    it('should flatten all fields', () => {
      const flat = getAllFieldsFlattened(fields);
      expect(flat).toHaveLength(3);
    });
  });

  describe('findParentId', () => {
    const fields: FormField[] = [
      { id: 'f1', type: 'text', label: 'Field 1' },
      {
        id: 'g1',
        type: 'group',
        label: 'Group',
        children: [{ id: 'f2', type: 'text', label: 'Nested' }],
      },
    ];

    it('should return root for top-level field', () => {
      expect(findParentId(fields, 'f1')).toBe('root');
    });

    it('should return parent id for nested field', () => {
      expect(findParentId(fields, 'f2')).toBe('g1');
    });
  });
});
