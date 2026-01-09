/**
 * Suite Types (OneLake JSON)
 *
 * Business grouping that references testcases.
 * When suite runs, all checks in selected testcases execute.
 *
 * Storage: Files/config/data/suites/{uuid}.json
 */

// Category options
export type SuiteCategory = 'Critical' | 'Important' | 'Standard' | 'Optional';

// Data domain options
export type DataDomain =
  | 'Sales'
  | 'Finance'
  | 'Marketing'
  | 'Operations'
  | 'HR'
  | 'Customer'
  | 'Product'
  | 'Other';

/**
 * Suite entity (stored as JSON file)
 */
export interface Suite {
  suite_id: string;            // UUID (filename)
  suite_name: string;
  suite_code: string;          // Short identifier (e.g., 'DQS-001')
  testcase_ids: string[];      // FK references to Testcases (N:M, 3-10 per suite)
  category: SuiteCategory;
  data_domain: DataDomain;
  description: string | null;
  execution_order: number;     // For scheduling priority
  owner: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;          // ISO timestamp
  version: string;             // ISO timestamp (optimistic locking)
}

/**
 * Input for creating a suite
 */
export interface SuiteInput {
  suite_name: string;
  suite_code?: string;
  testcase_ids?: string[];
  category?: SuiteCategory;
  data_domain?: DataDomain;
  description?: string;
  execution_order?: number;
  owner?: string;
  tags?: string[];
  is_active?: boolean;
}

/**
 * Input for updating a suite
 */
export interface SuiteUpdate extends Partial<SuiteInput> {
  version?: string;  // For optimistic locking
}

/**
 * Suite list item (for display)
 */
export interface SuiteListItem {
  suite_id: string;
  suite_name: string;
  suite_code: string;
  testcase_count: number;      // testcase_ids.length
  category: SuiteCategory;
  data_domain: DataDomain;
  is_active: boolean;
}

/**
 * Helper to create list item from suite
 */
export function toSuiteListItem(suite: Suite): SuiteListItem {
  return {
    suite_id: suite.suite_id,
    suite_name: suite.suite_name,
    suite_code: suite.suite_code,
    testcase_count: suite.testcase_ids.length,
    category: suite.category,
    data_domain: suite.data_domain,
    is_active: suite.is_active,
  };
}

// Category display options
export const categoryOptions: { value: SuiteCategory; label: string }[] = [
  { value: 'Critical', label: 'Critical' },
  { value: 'Important', label: 'Important' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Optional', label: 'Optional' },
];

// Data domain display options
export const dataDomainOptions: { value: DataDomain; label: string }[] = [
  { value: 'Sales', label: 'Sales' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Operations', label: 'Operations' },
  { value: 'HR', label: 'Human Resources' },
  { value: 'Customer', label: 'Customer' },
  { value: 'Product', label: 'Product' },
  { value: 'Other', label: 'Other' },
];

// Default suite input
export const defaultSuiteInput: SuiteInput = {
  suite_name: '',
  suite_code: '',
  testcase_ids: [],
  category: 'Standard',
  data_domain: 'Other',
  description: '',
  execution_order: 100,
  owner: '',
  tags: [],
  is_active: true,
};
