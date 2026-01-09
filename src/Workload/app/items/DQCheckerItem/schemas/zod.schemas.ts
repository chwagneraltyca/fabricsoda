/**
 * Zod Validation Schemas
 *
 * Runtime validation for JSON data before write operations.
 * Ensures data integrity without database constraints.
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

// Standard UUID format
const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime();

// Prefixed UUID format (e.g., "src-abc123-def456-...")
// Matches: prefix-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
const prefixedUuidRegex = /^[a-z]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const prefixedUuidSchema = z.string().regex(prefixedUuidRegex, 'Invalid prefixed UUID format');

// ============================================================================
// Source Schemas
// ============================================================================

export const sourceTypeSchema = z.enum([
  'fabric_warehouse',
  'fabric_sqldb',
  'spark_sql',
  'azure_sql',
]);

export const SourceSchema = z.object({
  source_id: prefixedUuidSchema, // e.g., "src-abc123-..."
  source_name: z.string().min(1).max(100),
  source_type: sourceTypeSchema,
  server_name: z.string().min(1).max(255),
  database_name: z.string().min(1).max(128),
  keyvault_uri: z.string().url().nullable().or(z.literal('')).or(z.null()), // Allow empty string or null
  client_id: z.string().uuid().nullable().or(z.literal('')).or(z.null()), // Allow empty string or null
  secret_name: z.string().max(128).nullable().or(z.literal('')).or(z.null()),
  description: z.string().max(500).nullable().or(z.literal('')).or(z.null()),
  is_active: z.boolean(),
  created_at: timestampSchema,
  version: timestampSchema,
});

export const SourceInputSchema = z.object({
  source_name: z.string().min(1).max(100),
  source_type: sourceTypeSchema,
  server_name: z.string().min(1).max(255),
  database_name: z.string().min(1).max(128),
  keyvault_uri: z.string().url().optional().or(z.literal('')),
  client_id: uuidSchema.optional().or(z.literal('')),
  secret_name: z.string().max(128).optional().or(z.literal('')),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional().default(true),
});

// ============================================================================
// Check Schemas
// ============================================================================

export const metricTypeSchema = z.enum([
  'row_count',
  'missing_count',
  'missing_percent',
  'invalid_count',
  'invalid_percent',
  'duplicate_count',
  'duplicate_percent',
  'freshness',
  'schema',
  'reference',
  'scalar',
  'custom_sql',
]);

export const comparisonOperatorSchema = z.enum([
  '>',
  '>=',
  '<',
  '<=',
  '=',
  '!=',
  'between',
]);

export const dimensionSchema = z.enum([
  'completeness',
  'accuracy',
  'consistency',
  'timeliness',
  'uniqueness',
  'validity',
]);

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low']);

// Polymorphic config schemas
export const freshnessConfigSchema = z.object({
  freshness_column: z.string().min(1),
  threshold_value: z.number().positive(),
  threshold_unit: z.enum(['minutes', 'hours', 'days']),
});

export const schemaConfigSchema = z.object({
  required_columns: z.array(z.string()).optional(),
  forbidden_columns: z.array(z.string()).optional(),
  column_types: z.record(z.string(), z.string()).optional(),
  column_indexes: z.array(z.string()).optional(),
  warn_required_missing: z.boolean().optional(),
  warn_forbidden_present: z.boolean().optional(),
  fail_required_missing: z.boolean().optional(),
  fail_forbidden_present: z.boolean().optional(),
});

export const referenceConfigSchema = z.object({
  reference_table: z.string().min(1),
  reference_column: z.string().min(1),
  reference_sql_query: z.string().optional(),
});

export const scalarConfigSchema = z.object({
  query_a: z.string().min(1),
  query_b: z.string().optional(),
  comparison_operator: comparisonOperatorSchema,
  tolerance_value: z.number().optional(),
  tolerance_type: z.enum(['absolute', 'percent']).optional(),
});

export const customSqlConfigSchema = z.object({
  custom_sql_query: z.string().min(1),
});

export const checkConfigSchema = z.union([
  freshnessConfigSchema,
  schemaConfigSchema,
  referenceConfigSchema,
  scalarConfigSchema,
  customSqlConfigSchema,
  z.object({}), // Empty config for simple metrics
]);

export const CheckSchema = z.object({
  check_id: prefixedUuidSchema, // e.g., "chk-abc123-..."
  check_name: z.string().min(1).max(100),
  column_name: z.string().max(128).optional(),
  metric: metricTypeSchema,
  config: checkConfigSchema,
  fail_comparison: comparisonOperatorSchema.optional(),
  fail_threshold: z.number().optional(),
  warn_comparison: comparisonOperatorSchema.optional(),
  warn_threshold: z.number().optional(),
  filter_condition: z.string().max(1000).optional(),
  dimension: dimensionSchema,
  severity: severitySchema,
  owner: z.string().max(255).optional(),
  tags: z.array(z.string()).optional(),
  is_enabled: z.boolean(),
});

export const CheckInputSchema = CheckSchema.omit({ check_id: true }).partial({
  config: true,
  dimension: true,
  severity: true,
  is_enabled: true,
});

// ============================================================================
// Testcase Schemas
// ============================================================================

export const TestcaseSchema = z.object({
  testcase_id: prefixedUuidSchema, // e.g., "tc-abc123-..."
  testcase_name: z.string().min(1).max(100),
  source_id: prefixedUuidSchema, // FK to Source
  schema_name: z.string().min(1).max(128),
  table_name: z.string().min(1).max(128),
  description: z.string().max(500).nullable().optional(),
  owner: z.string().max(255).nullable().optional(),
  tags: z.array(z.string()),
  checks: z.array(CheckSchema),
  is_active: z.boolean(),
  created_at: timestampSchema,
  version: timestampSchema,
});

export const TestcaseInputSchema = z.object({
  testcase_name: z.string().min(1).max(100),
  source_id: prefixedUuidSchema, // FK to Source
  schema_name: z.string().min(1).max(128),
  table_name: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  owner: z.string().max(255).optional(),
  tags: z.array(z.string()).optional().default([]),
  checks: z.array(CheckInputSchema).optional().default([]),
  is_active: z.boolean().optional().default(true),
});

// ============================================================================
// Suite Schemas
// ============================================================================

export const categorySchema = z.enum(['Critical', 'Important', 'Standard', 'Optional']);

export const dataDomainSchema = z.enum([
  'Sales',
  'Finance',
  'Marketing',
  'Operations',
  'HR',
  'Customer',
  'Product',
  'Other',
]);

export const SuiteSchema = z.object({
  suite_id: prefixedUuidSchema, // e.g., "suite-abc123-..."
  suite_name: z.string().min(1).max(100),
  suite_code: z.string().min(1).max(20),
  testcase_ids: z.array(prefixedUuidSchema), // FK[] to Testcases
  category: categorySchema,
  data_domain: dataDomainSchema,
  description: z.string().max(500).nullable().optional(),
  execution_order: z.number().int().min(0).max(9999),
  owner: z.string().max(255).nullable().optional(),
  tags: z.array(z.string()),
  is_active: z.boolean(),
  created_at: timestampSchema,
  version: timestampSchema,
});

export const SuiteInputSchema = z.object({
  suite_name: z.string().min(1).max(100),
  suite_code: z.string().max(20).optional().default(''),
  testcase_ids: z.array(prefixedUuidSchema).optional().default([]), // FK[] to Testcases
  category: categorySchema.optional().default('Standard'),
  data_domain: dataDomainSchema.optional().default('Other'),
  description: z.string().max(500).optional(),
  execution_order: z.number().int().min(0).max(9999).optional().default(100),
  owner: z.string().max(255).optional(),
  tags: z.array(z.string()).optional().default([]),
  is_active: z.boolean().optional().default(true),
});

// ============================================================================
// Type Inference (from Zod schemas)
// ============================================================================

export type SourceZ = z.infer<typeof SourceSchema>;
export type SourceInputZ = z.infer<typeof SourceInputSchema>;
export type CheckZ = z.infer<typeof CheckSchema>;
export type CheckInputZ = z.infer<typeof CheckInputSchema>;
export type TestcaseZ = z.infer<typeof TestcaseSchema>;
export type TestcaseInputZ = z.infer<typeof TestcaseInputSchema>;
export type SuiteZ = z.infer<typeof SuiteSchema>;
export type SuiteInputZ = z.infer<typeof SuiteInputSchema>;

// ============================================================================
// Validation Result Type
// ============================================================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors?: undefined;
}

export interface ValidationFailure {
  success: false;
  data?: undefined;
  errors: string[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate source data (returns result object)
 */
export function validateSource(data: unknown): ValidationResult<SourceZ> {
  const result = SourceSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e) => e.message) };
}

/**
 * Validate source input (returns result object)
 */
export function validateSourceInput(data: unknown): ValidationResult<SourceInputZ> {
  const result = SourceInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e) => e.message) };
}

/**
 * Validate testcase data (returns result object)
 */
export function validateTestcase(data: unknown): ValidationResult<TestcaseZ> {
  const result = TestcaseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e) => e.message) };
}

/**
 * Validate testcase input (returns result object)
 */
export function validateTestcaseInput(data: unknown): ValidationResult<TestcaseInputZ> {
  const result = TestcaseInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e) => e.message) };
}

/**
 * Validate suite data (returns result object)
 */
export function validateSuite(data: unknown): ValidationResult<SuiteZ> {
  const result = SuiteSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e) => e.message) };
}

/**
 * Validate suite input (returns result object)
 */
export function validateSuiteInput(data: unknown): ValidationResult<SuiteInputZ> {
  const result = SuiteInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e) => e.message) };
}
