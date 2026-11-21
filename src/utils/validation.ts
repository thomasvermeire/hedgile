import { z, ZodError, ZodIssue } from 'zod';

/**
 * Custom error class for validation errors.
 * Provides consistent error handling across the application.
 */
export class ValidationError extends Error {
  public readonly issues: ZodIssue[];
  public readonly statusCode: number;

  constructor(message: string, issues: ZodIssue[], statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
    this.statusCode = statusCode;
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to a plain object for logging or API responses.
   */
  toJSON(): object {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      issues: this.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      })),
    };
  }
}

/**
 * Validate data against a zod schema and return the parsed result.
 * @param schema - The zod schema to validate against
 * @param data - The data to validate
 * @throws ValidationError if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Validation failed', error.issues, 400);
    }
    throw error;
  }
}

/**
 * Validate data against a zod schema and return the result or null if validation fails.
 * @param schema - The zod schema to validate against
 * @param data - The data to validate
 * @returns The parsed result or null if validation fails
 */
export function validateOrNull<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Create a validation error from a zod error.
 * @param error - The zod error to convert
 * @returns A ValidationError instance
 */
export function fromZodError(error: ZodError): ValidationError {
  return new ValidationError('Validation failed', error.issues, 400);
}

/**
 * Schema for validating positive numbers.
 */
export const positiveNumberSchema = z.number().positive();

/**
 * Schema for validating non-empty strings.
 */
export const nonEmptyStringSchema = z.string().min(1);

/**
 * Schema for validating ISO 8601 dates.
 */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Schema for validating ISO 8601 date-time strings.
 * Accepts formats like: 2024-01-15T10:00:00Z or 2024-01-15T10:00:00+00:00
 */
export const isoDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/);
