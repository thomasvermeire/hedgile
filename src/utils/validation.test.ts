import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ValidationError,
  validate,
  validateOrNull,
  fromZodError,
  positiveNumberSchema,
  nonEmptyStringSchema,
  isoDateSchema,
  isoDateTimeSchema,
} from './validation.js';

describe('Validation Utilities', () => {
  describe('ValidationError', () => {
    it('should create a validation error with issues', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['name'],
          message: 'Invalid input: expected string, received number',
        },
      ];

      const error = new ValidationError('Test error', issues, 400);

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]?.path).toEqual(['name']);
    });

    it('should convert to JSON', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['name'],
          message: 'Invalid input: expected string, received number',
        },
      ];

      const error = new ValidationError('Test error', issues, 400);
      const json = error.toJSON();

      expect(json).toHaveProperty('error', 'ValidationError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('statusCode', 400);
      expect(json).toHaveProperty('issues');
    });
  });

  describe('validate', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number().positive(),
    });

    it('should return parsed data when validation passes', () => {
      const data = { name: 'Test', age: 25 };
      const result = validate(testSchema, data);

      expect(result.name).toBe('Test');
      expect(result.age).toBe(25);
    });

    it('should throw ValidationError when validation fails', () => {
      const data = { name: 'Test', age: -5 };

      expect(() => validate(testSchema, data)).toThrow(ValidationError);
    });

    it('should throw ValidationError with correct issues', () => {
      const data = { name: 123, age: 'not a number' };

      try {
        validate(testSchema, data);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const valError = error as ValidationError;
        expect(valError.issues).toHaveLength(2);
      }
    });
  });

  describe('validateOrNull', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number().positive(),
    });

    it('should return parsed data when validation passes', () => {
      const data = { name: 'Test', age: 25 };
      const result = validateOrNull(testSchema, data);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test');
      expect(result?.age).toBe(25);
    });

    it('should return null when validation fails', () => {
      const data = { name: 'Test', age: -5 };
      const result = validateOrNull(testSchema, data);

      expect(result).toBeNull();
    });
  });

  describe('fromZodError', () => {
    it('should create ValidationError from ZodError', () => {
      const schema = z.object({ name: z.string() });
      const data = { name: 123 };

      try {
        schema.parse(data);
        expect.fail('Should have thrown');
      } catch (error) {
        if (error instanceof z.ZodError) {
          const valError = fromZodError(error);
          expect(valError).toBeInstanceOf(ValidationError);
          expect(valError.issues).toHaveLength(1);
          expect(valError.statusCode).toBe(400);
        }
      }
    });
  });

  describe('positiveNumberSchema', () => {
    it('should validate positive numbers', () => {
      expect(() => positiveNumberSchema.parse(10)).not.toThrow();
      expect(() => positiveNumberSchema.parse(0.1)).not.toThrow();
    });

    it('should reject non-positive numbers', () => {
      expect(() => positiveNumberSchema.parse(0)).toThrow();
      expect(() => positiveNumberSchema.parse(-1)).toThrow();
    });
  });

  describe('nonEmptyStringSchema', () => {
    it('should validate non-empty strings', () => {
      expect(() => nonEmptyStringSchema.parse('test')).not.toThrow();
      expect(() => nonEmptyStringSchema.parse(' ')).not.toThrow();
    });

    it('should reject empty strings', () => {
      expect(() => nonEmptyStringSchema.parse('')).toThrow();
    });
  });

  describe('isoDateSchema', () => {
    it('should validate ISO 8601 dates', () => {
      expect(() => isoDateSchema.parse('2024-01-15')).not.toThrow();
      expect(() => isoDateSchema.parse('2024-12-31')).not.toThrow();
    });

    it('should reject invalid date formats', () => {
      expect(() => isoDateSchema.parse('2024/01/15')).toThrow();
      expect(() => isoDateSchema.parse('15-01-2024')).toThrow();
      expect(() => isoDateSchema.parse('2024-01-15T10:00:00Z')).toThrow();
    });
  });

  describe('isoDateTimeSchema', () => {
    it('should validate ISO 8601 date-time strings', () => {
      expect(() => isoDateTimeSchema.parse('2024-01-15T10:00:00Z')).not.toThrow();
      expect(() => isoDateTimeSchema.parse('2024-01-15T10:00:00+00:00')).not.toThrow();
    });

    it('should reject invalid date-time formats', () => {
      expect(() => isoDateTimeSchema.parse('2024-01-15')).toThrow();
      expect(() => isoDateTimeSchema.parse('2024-01-15T10:00:00')).toThrow();
    });
  });
});
