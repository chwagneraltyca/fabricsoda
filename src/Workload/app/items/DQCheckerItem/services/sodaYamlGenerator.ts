/**
 * Soda YAML Generator
 *
 * Converts Check[] to Soda Core YAML format.
 * Based on Legacy yaml_generator.py implementation.
 *
 * Key patterns:
 * - Checks are grouped by table under "checks for {schema}.{table}:"
 * - Check ID is embedded in name: "Check Name [check_id:uuid]"
 * - Filter conditions can be SQL WHERE or validation rules (valid format: email)
 */

import {
  Check,
  FreshnessConfig,
  SchemaConfig,
  ReferenceConfig,
  ScalarConfig,
  CustomSqlConfig,
} from '../types/check.types';

/**
 * Generate Soda YAML from checks array
 */
export function generateSodaYaml(
  checks: Check[],
  schemaName: string,
  tableName: string
): string {
  if (checks.length === 0) {
    return '# No checks configured';
  }

  const lines: string[] = [];
  const qualifiedTable = `${schemaName}.${tableName}`;

  lines.push(`checks for ${qualifiedTable}:`);

  for (const check of checks) {
    const checkLines = generateCheckYaml(check);
    lines.push(...checkLines);
  }

  return lines.join('\n');
}

/**
 * Generate YAML lines for a single check
 */
function generateCheckYaml(check: Check): string[] {
  const lines: string[] = [];
  const nameWithId = `${check.check_name} [check_id:${check.check_id}]`;

  switch (check.metric) {
    case 'row_count':
      lines.push(...generateRowCountYaml(check, nameWithId));
      break;

    case 'missing_count':
    case 'missing_percent':
      lines.push(...generateMissingYaml(check, nameWithId));
      break;

    case 'duplicate_count':
    case 'duplicate_percent':
      lines.push(...generateDuplicateYaml(check, nameWithId));
      break;

    case 'invalid_count':
    case 'invalid_percent':
      lines.push(...generateInvalidYaml(check, nameWithId));
      break;

    case 'min':
    case 'max':
    case 'avg':
    case 'sum':
    case 'avg_length':
      lines.push(...generateNumericYaml(check, nameWithId));
      break;

    case 'freshness':
      lines.push(...generateFreshnessYaml(check, nameWithId));
      break;

    case 'schema':
      lines.push(...generateSchemaYaml(check, nameWithId));
      break;

    case 'reference':
      lines.push(...generateReferenceYaml(check, nameWithId));
      break;

    case 'custom_sql':
      lines.push(...generateCustomSqlYaml(check, nameWithId));
      break;

    case 'scalar_comparison':
      lines.push(...generateScalarComparisonYaml(check, nameWithId));
      break;

    default:
      lines.push(`  # Unsupported metric: ${check.metric}`);
  }

  lines.push(''); // Blank line between checks
  return lines;
}

/**
 * Generate row_count check YAML
 */
function generateRowCountYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const threshold = formatThreshold(check.fail_comparison, check.fail_threshold);

  lines.push(`  - row_count ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);

  if (check.warn_comparison && check.warn_threshold !== undefined) {
    lines.push(`      warn: when ${check.warn_comparison} ${check.warn_threshold}`);
  }

  return lines;
}

/**
 * Generate missing_count/missing_percent check YAML
 */
function generateMissingYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const column = quoteColumnIfNeeded(check.column_name || '');
  const threshold = formatThreshold(check.fail_comparison, check.fail_threshold);

  lines.push(`  - ${check.metric}(${column}) ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);

  // Additional missing values from filter_condition
  if (check.filter_condition && !check.filter_condition.startsWith('valid ')) {
    const missingValues = check.filter_condition.split(',').map(v => v.trim()).filter(Boolean);
    if (missingValues.length > 0) {
      lines.push(`      missing values: [${missingValues.map(v => `"${v}"`).join(', ')}]`);
    }
  }

  if (check.warn_comparison && check.warn_threshold !== undefined) {
    lines.push(`      warn: when ${check.warn_comparison} ${check.warn_threshold}`);
  }

  return lines;
}

/**
 * Generate duplicate_count/duplicate_percent check YAML
 */
function generateDuplicateYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const column = quoteColumnIfNeeded(check.column_name || '');
  const threshold = formatThreshold(check.fail_comparison, check.fail_threshold);

  lines.push(`  - ${check.metric}(${column}) ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);

  if (check.warn_comparison && check.warn_threshold !== undefined) {
    lines.push(`      warn: when ${check.warn_comparison} ${check.warn_threshold}`);
  }

  return lines;
}

/**
 * Generate invalid_count/invalid_percent check YAML with validation rules
 */
function generateInvalidYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const column = quoteColumnIfNeeded(check.column_name || '');
  const threshold = formatThreshold(check.fail_comparison, check.fail_threshold);

  lines.push(`  - ${check.metric}(${column}) ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);

  // Validation rules from filter_condition
  if (check.filter_condition) {
    if (check.filter_condition.startsWith('valid ')) {
      // Direct pass-through for validation rules
      lines.push(`      ${check.filter_condition}`);
    } else {
      // SQL filter
      lines.push(`      filter: ${escapeYamlString(check.filter_condition)}`);
    }
  }

  if (check.warn_comparison && check.warn_threshold !== undefined) {
    lines.push(`      warn: when ${check.warn_comparison} ${check.warn_threshold}`);
  }

  return lines;
}

/**
 * Generate numeric metric (min, max, avg, sum, avg_length) check YAML
 */
function generateNumericYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const column = quoteColumnIfNeeded(check.column_name || '');
  const threshold = formatThreshold(check.fail_comparison, check.fail_threshold);

  lines.push(`  - ${check.metric}(${column}) ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);

  if (check.filter_condition && !check.filter_condition.startsWith('valid ')) {
    lines.push(`      filter: ${escapeYamlString(check.filter_condition)}`);
  }

  if (check.warn_comparison && check.warn_threshold !== undefined) {
    lines.push(`      warn: when ${check.warn_comparison} ${check.warn_threshold}`);
  }

  return lines;
}

/**
 * Generate freshness check YAML
 */
function generateFreshnessYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const config = check.config as FreshnessConfig;

  const column = quoteColumnIfNeeded(config.freshness_column || '');
  const unitSuffix = config.threshold_unit === 'minutes' ? 'm' :
                     config.threshold_unit === 'hours' ? 'h' : 'd';
  const threshold = `${config.threshold_value || 24}${unitSuffix}`;

  lines.push(`  - freshness(${column}) < ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);

  return lines;
}

/**
 * Generate schema validation check YAML
 */
function generateSchemaYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const config = check.config as SchemaConfig;

  lines.push(`  - schema:`);
  lines.push(`      name: "${nameWithId}"`);

  if (config.required_columns && config.required_columns.length > 0) {
    lines.push(`      fail:`);
    lines.push(`        when required column missing: [${config.required_columns.join(', ')}]`);
  }

  if (config.forbidden_columns && config.forbidden_columns.length > 0) {
    if (!lines.some(l => l.includes('fail:'))) {
      lines.push(`      fail:`);
    }
    lines.push(`        when forbidden column present: [${config.forbidden_columns.join(', ')}]`);
  }

  return lines;
}

/**
 * Generate reference (FK) check YAML as failed rows
 */
function generateReferenceYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const config = check.config as ReferenceConfig;
  const column = quoteColumnIfNeeded(check.column_name || '');

  lines.push(`  - failed rows:`);
  lines.push(`      name: "${nameWithId}"`);
  lines.push(`      fail query: |`);
  lines.push(`        SELECT * FROM ${check.column_name ? `(SELECT ${column} FROM __TABLE__) t` : '__TABLE__'}`);
  lines.push(`        WHERE ${column} IS NOT NULL`);
  lines.push(`          AND ${column} NOT IN (`);
  lines.push(`            SELECT ${config.reference_column} FROM ${config.reference_table}`);
  lines.push(`          )`);

  return lines;
}

/**
 * Generate custom SQL check YAML
 */
function generateCustomSqlYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const config = check.config as CustomSqlConfig;

  // Create a safe metric name from check name
  const safeMetricName = check.check_name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const threshold = formatThreshold(check.fail_comparison, check.fail_threshold);

  lines.push(`  - ${safeMetricName} ${threshold}:`);
  lines.push(`      name: "${nameWithId}"`);
  lines.push(`      ${safeMetricName} query: |`);

  // Indent SQL query
  const queryLines = (config.custom_sql_query || '').split('\n');
  for (const line of queryLines) {
    lines.push(`        ${line}`);
  }

  if (check.warn_comparison && check.warn_threshold !== undefined) {
    lines.push(`      warn: when ${check.warn_comparison} ${check.warn_threshold}`);
  }

  return lines;
}

/**
 * Generate scalar comparison check YAML
 */
function generateScalarComparisonYaml(check: Check, nameWithId: string): string[] {
  const lines: string[] = [];
  const config = check.config as ScalarConfig;

  lines.push(`  - failed rows:`);
  lines.push(`      name: "${nameWithId}"`);
  lines.push(`      fail query: |`);
  lines.push(`        WITH comparison AS (`);
  lines.push(`          SELECT`);
  lines.push(`            (${config.query_a}) AS query_a,`);
  lines.push(`            (${config.query_b || config.query_a}) AS query_b`);
  lines.push(`        )`);
  lines.push(`        SELECT query_a, query_b, query_a - query_b AS difference`);
  lines.push(`        FROM comparison`);

  if (config.tolerance_value && config.tolerance_type === 'percent') {
    const tolerancePercent = config.tolerance_value / 100;
    lines.push(`        WHERE ABS(query_a - query_b) > query_a * ${tolerancePercent}`);
  } else {
    lines.push(`        WHERE query_a != query_b`);
  }

  return lines;
}

/**
 * Format threshold expression
 */
function formatThreshold(comparison?: string, threshold?: number): string {
  if (comparison === undefined || threshold === undefined) {
    return '>= 0';
  }

  // Normalize comparison operator
  const normalizedComparison = comparison === '==' ? '=' : comparison;

  return `${normalizedComparison} ${threshold}`;
}

/**
 * Quote column name if it contains special characters
 */
function quoteColumnIfNeeded(column: string): string {
  if (!column) return column;
  // Quote if contains space, hyphen, or starts with number
  if (/[\s\-]/.test(column) || /^\d/.test(column)) {
    return `"${column}"`;
  }
  return column;
}

/**
 * Escape string for YAML
 */
function escapeYamlString(str: string): string {
  // Simple escape for special YAML characters
  if (/[:#\[\]{}|>]/.test(str)) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return str;
}

export default { generateSodaYaml };
