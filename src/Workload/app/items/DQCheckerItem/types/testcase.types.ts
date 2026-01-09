/**
 * Testcase Types (OneLake JSON)
 *
 * Table scope container with embedded checks.
 * Maps to Soda YAML section: `checks for {schema}.{table}:`
 *
 * Storage: Files/config/data/testcases/{uuid}.json
 */

import { Check, CheckInput } from './check.types';

/**
 * Testcase entity (stored as JSON file with embedded checks)
 */
export interface Testcase {
  testcase_id: string;         // UUID (filename)
  testcase_name: string;
  source_id: string;           // FK to Source
  schema_name: string;         // Database schema (e.g., 'dbo')
  table_name: string;          // Table name (e.g., 'orders')
  description: string | null;
  owner: string | null;
  tags: string[];
  checks: Check[];             // Embedded checks (10-20 per testcase)
  is_active: boolean;
  created_at: string;          // ISO timestamp
  version: string;             // ISO timestamp (optimistic locking)
}

/**
 * Input for creating a testcase
 */
export interface TestcaseInput {
  testcase_name: string;
  source_id: string;
  schema_name: string;
  table_name: string;
  description?: string;
  owner?: string;
  tags?: string[];
  checks?: CheckInput[];       // Optional initial checks
  is_active?: boolean;
}

/**
 * Input for updating a testcase
 */
export interface TestcaseUpdate extends Partial<Omit<TestcaseInput, 'checks'>> {
  checks?: Check[];  // Full checks array for updates
  version?: string;  // For optimistic locking
}

/**
 * Testcase list item (for display without full checks)
 */
export interface TestcaseListItem {
  testcase_id: string;
  testcase_name: string;
  source_id: string;
  schema_name: string;
  table_name: string;
  check_count: number;         // Computed from checks.length
  enabled_check_count: number; // Computed from checks.filter(c => c.is_enabled).length
  is_active: boolean;
}

/**
 * Helper to create list item from testcase
 */
export function toTestcaseListItem(testcase: Testcase): TestcaseListItem {
  return {
    testcase_id: testcase.testcase_id,
    testcase_name: testcase.testcase_name,
    source_id: testcase.source_id,
    schema_name: testcase.schema_name,
    table_name: testcase.table_name,
    check_count: testcase.checks.length,
    enabled_check_count: testcase.checks.filter(c => c.is_enabled).length,
    is_active: testcase.is_active,
  };
}

/**
 * Full table reference (schema.table)
 */
export function getTableRef(testcase: Testcase | TestcaseListItem): string {
  return `${testcase.schema_name}.${testcase.table_name}`;
}

// Default testcase input
export const defaultTestcaseInput: TestcaseInput = {
  testcase_name: '',
  source_id: '',
  schema_name: 'dbo',
  table_name: '',
  description: '',
  owner: '',
  tags: [],
  checks: [],
  is_active: true,
};
