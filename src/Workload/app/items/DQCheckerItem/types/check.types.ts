/**
 * Check Types (OneLake JSON)
 *
 * Individual DQ check rules embedded in testcase files.
 * Supports polymorphic config for different metric types.
 *
 * Storage: Embedded in testcases/{uuid}.json checks[] array
 */

// Metric types (Soda Core compatible)
// Table-level (5): row_count, freshness, schema, custom_sql, scalar_comparison
// Column-level (9): missing_count, duplicate_count, invalid_count, min, max, avg, sum, avg_length, reference
export type MetricType =
  // Table-level checks (column_name: null)
  | 'row_count'
  | 'freshness'
  | 'schema'
  | 'custom_sql'
  | 'scalar_comparison'
  // Column-level checks (column_name: required)
  | 'missing_count'
  | 'missing_percent'
  | 'duplicate_count'
  | 'duplicate_percent'
  | 'invalid_count'
  | 'invalid_percent'
  | 'min'
  | 'max'
  | 'avg'
  | 'sum'
  | 'avg_length'
  | 'reference';

// Comparison operators
export type ComparisonOperator = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'between';

// DQ dimension categories
export type DQDimension =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'validity';

// Severity levels
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

// Polymorphic config types
export interface FreshnessConfig {
  freshness_column: string;
  threshold_value: number;
  threshold_unit: 'minutes' | 'hours' | 'days';
}

export interface SchemaConfig {
  required_columns?: string[];
  forbidden_columns?: string[];
  column_types?: Record<string, string>;
  column_indexes?: string[];
  warn_required_missing?: boolean;
  warn_forbidden_present?: boolean;
  fail_required_missing?: boolean;
  fail_forbidden_present?: boolean;
}

export interface ReferenceConfig {
  reference_table: string;
  reference_column: string;
  reference_sql_query?: string;
}

export interface ScalarConfig {
  query_a: string;
  query_b?: string;
  comparison_operator: ComparisonOperator;
  tolerance_value?: number;
  tolerance_type?: 'absolute' | 'percent';
}

export interface CustomSqlConfig {
  custom_sql_query: string;
}

// Union of all config types
export type CheckConfig =
  | FreshnessConfig
  | SchemaConfig
  | ReferenceConfig
  | ScalarConfig
  | CustomSqlConfig
  | Record<string, never>;  // Empty config for simple metrics

/**
 * Check entity (embedded in testcase)
 */
export interface Check {
  check_id: string;            // UUID
  check_name: string;
  column_name?: string;        // Optional (table-level checks have no column)
  metric: MetricType;
  config: CheckConfig;         // Polymorphic config based on metric type
  fail_comparison?: ComparisonOperator;
  fail_threshold?: number;
  warn_comparison?: ComparisonOperator;
  warn_threshold?: number;
  filter_condition?: string;   // SQL WHERE clause
  dimension: DQDimension;
  severity: SeverityLevel;
  owner?: string;
  tags?: string[];
  is_enabled: boolean;
}

/**
 * Input for creating a check
 */
export interface CheckInput {
  check_name: string;
  column_name?: string;
  metric: MetricType;
  config?: CheckConfig;
  fail_comparison?: ComparisonOperator;
  fail_threshold?: number;
  warn_comparison?: ComparisonOperator;
  warn_threshold?: number;
  filter_condition?: string;
  dimension?: DQDimension;
  severity?: SeverityLevel;
  owner?: string;
  tags?: string[];
  is_enabled?: boolean;
}

/**
 * Input for updating a check
 */
export type CheckUpdate = Partial<CheckInput>;

// Metric categories for sidebar display
export type MetricCategory = 'completeness' | 'validity' | 'uniqueness' | 'statistics' | 'table_level' | 'referential';

// Metric type display options with category
export interface MetricTypeOption {
  value: MetricType;
  label: string;
  description: string;
  hasColumn: boolean;
  category: MetricCategory;
  columnType?: 'numeric' | 'string' | 'datetime' | 'any';  // For column selector filtering
}

export const metricTypeOptions: MetricTypeOption[] = [
  // Completeness
  { value: 'missing_count', label: 'Missing Count', description: 'Count NULL or empty values', hasColumn: true, category: 'completeness', columnType: 'any' },
  { value: 'missing_percent', label: 'Missing Percent', description: 'Percent of NULL or empty values', hasColumn: true, category: 'completeness', columnType: 'any' },

  // Validity
  { value: 'invalid_count', label: 'Invalid Count', description: 'Count values failing validation', hasColumn: true, category: 'validity', columnType: 'any' },
  { value: 'invalid_percent', label: 'Invalid Percent', description: 'Percent of invalid values', hasColumn: true, category: 'validity', columnType: 'any' },

  // Uniqueness
  { value: 'duplicate_count', label: 'Duplicate Count', description: 'Count duplicate values', hasColumn: true, category: 'uniqueness', columnType: 'any' },
  { value: 'duplicate_percent', label: 'Duplicate Percent', description: 'Percent of duplicates', hasColumn: true, category: 'uniqueness', columnType: 'any' },

  // Statistics (numeric column metrics)
  { value: 'min', label: 'Minimum', description: 'Minimum value in column', hasColumn: true, category: 'statistics', columnType: 'numeric' },
  { value: 'max', label: 'Maximum', description: 'Maximum value in column', hasColumn: true, category: 'statistics', columnType: 'numeric' },
  { value: 'avg', label: 'Average', description: 'Average value in column', hasColumn: true, category: 'statistics', columnType: 'numeric' },
  { value: 'sum', label: 'Sum', description: 'Sum of values in column', hasColumn: true, category: 'statistics', columnType: 'numeric' },
  { value: 'avg_length', label: 'Avg Length', description: 'Average string length', hasColumn: true, category: 'statistics', columnType: 'string' },

  // Table-level checks
  { value: 'row_count', label: 'Row Count', description: 'Count total rows in table', hasColumn: false, category: 'table_level' },
  { value: 'freshness', label: 'Freshness', description: 'Data age based on timestamp column', hasColumn: false, category: 'table_level' },
  { value: 'schema', label: 'Schema', description: 'Validate table structure', hasColumn: false, category: 'table_level' },
  { value: 'custom_sql', label: 'Custom SQL', description: 'Run custom SQL check', hasColumn: false, category: 'table_level' },
  { value: 'scalar_comparison', label: 'Scalar Compare', description: 'Compare query results', hasColumn: false, category: 'table_level' },

  // Referential integrity
  { value: 'reference', label: 'Reference', description: 'Check foreign key integrity', hasColumn: true, category: 'referential', columnType: 'any' },
];

// Category display labels
export const metricCategoryLabels: Record<MetricCategory, string> = {
  completeness: 'Completeness',
  validity: 'Validity',
  uniqueness: 'Uniqueness',
  statistics: 'Statistics',
  table_level: 'Table Level',
  referential: 'Referential',
};

// Helper to get metrics by category
export const getMetricsByCategory = (category: MetricCategory): MetricTypeOption[] =>
  metricTypeOptions.filter(m => m.category === category);

// Helper to find metric option by value
export const getMetricOption = (metric: MetricType): MetricTypeOption | undefined =>
  metricTypeOptions.find(m => m.value === metric);

// Dimension display options
export const dimensionOptions: { value: DQDimension; label: string }[] = [
  { value: 'completeness', label: 'Completeness' },
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'timeliness', label: 'Timeliness' },
  { value: 'uniqueness', label: 'Uniqueness' },
  { value: 'validity', label: 'Validity' },
];

// Severity display options
export const severityOptions: { value: SeverityLevel; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// Default check input
export const defaultCheckInput: CheckInput = {
  check_name: '',
  metric: 'row_count',
  config: {},
  fail_comparison: '>',
  fail_threshold: 0,
  dimension: 'completeness',
  severity: 'medium',
  is_enabled: true,
};
