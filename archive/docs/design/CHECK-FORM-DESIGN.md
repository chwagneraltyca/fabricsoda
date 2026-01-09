# DQ Check Form - Fabric SDK Optimized Design

## Key Learnings from MS Docs

1. **Stored Procedures for Mutations** - Recommended by Microsoft
   - "Business logic lives inside the procedure, not the client"
   - SPs provide validation, transformation, ID generation
   - Exposed as `executeXxx` mutations in GraphQL

2. **Direct Table Mutations** - Require primary keys defined
   - Work for simple CRUD without business logic
   - Auto-generated: `createXxx`, `updateXxx`, `deleteXxx`

3. **Our Approach**: Use SPs for check creation (validated in testing)

---

## Legacy vs Optimized Design

### Legacy (Flask + Alpine.js)

```
22 separate templates → 22 conditional form sections → SP routing in Python
```

Problems:
- 1300+ lines in single template file
- Complex Alpine.js state management
- Duplicate code across templates
- SP routing logic in application layer

### Fabric SDK Optimized

```
Schema-driven form config → Dynamic React renderer → Legacy SP pattern (easy migration)
```

Benefits:
- Configuration over code
- Single source of truth for form structure
- Reduced bundle size
- **Legacy SP naming** (same as Flask app - easy migration)
- Server-side validation in SP

---

## Optimized Architecture

### 1. Check Type Configuration (Schema-Driven)

Instead of 22 hardcoded templates, define check types in a configuration:

```typescript
// checkTypes.ts
export const CHECK_TYPES = {
  // Completeness
  row_count: {
    category: 'Completeness',
    label: 'Row Count',
    requiresColumn: false,
    fields: ['thresholds'],
  },
  missing_count: {
    category: 'Completeness',
    label: 'Missing Values',
    requiresColumn: true,
    fields: ['thresholds'],
  },

  // Accuracy
  aggregation_metric: {
    category: 'Accuracy',
    label: 'Aggregation Metric',
    requiresColumn: true,
    fields: ['aggregation', 'thresholds'],
  },

  // Advanced
  freshness: {
    category: 'Advanced',
    label: 'Freshness',
    requiresColumn: true, // datetime column
    fields: ['freshness'],
    extension: 'dq_checks_freshness',
  },
  schema: {
    category: 'Advanced',
    label: 'Schema Validation',
    requiresColumn: false,
    fields: ['schema_validation'],
    extension: 'dq_checks_schema',
  },
  // ... etc
} as const;

// Field configurations
export const FIELD_GROUPS = {
  thresholds: {
    component: 'ThresholdFields',
    fields: ['fail_comparison', 'fail_threshold', 'warn_comparison', 'warn_threshold'],
  },
  aggregation: {
    component: 'AggregationFields',
    fields: ['metric'], // avg, sum, min, max, etc.
  },
  freshness: {
    component: 'FreshnessFields',
    fields: ['freshness_column', 'threshold_value', 'threshold_unit'],
  },
  schema_validation: {
    component: 'SchemaValidationFields',
    fields: ['required_columns', 'forbidden_columns', 'column_types'],
  },
};
```

### 2. Dynamic Form Renderer

```typescript
// CheckForm.tsx
function CheckForm({ checkType, onSubmit }) {
  const config = CHECK_TYPES[checkType];
  const form = useCheckForm(checkType);  // Custom hook with validation

  return (
    <Form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Always visible: basic fields */}
      <BaseFields form={form} />

      {/* Conditional: column selector */}
      {config.requiresColumn && <ColumnSelector form={form} />}

      {/* Dynamic: render field groups based on config */}
      {config.fields.map(fieldGroup => (
        <FieldGroup key={fieldGroup} name={fieldGroup} form={form} />
      ))}

      {/* Always visible: metadata */}
      <MetadataFields form={form} />
    </Form>
  );
}
```

### 3. Consolidated Field Components

Instead of duplicating threshold logic in 22 templates:

```typescript
// ThresholdFields.tsx
function ThresholdFields({ form }) {
  return (
    <Fieldset legend="Thresholds">
      <Field label="Fail when" required>
        <div style={{ display: 'flex', gap: 8 }}>
          <Dropdown
            {...form.register('fail_comparison')}
            options={COMPARISON_OPTIONS} // >, <, >=, <=, =, !=
          />
          <Input
            type="number"
            {...form.register('fail_threshold')}
          />
        </div>
      </Field>

      <Field label="Warn when">
        <div style={{ display: 'flex', gap: 8 }}>
          <Dropdown {...form.register('warn_comparison')} options={COMPARISON_OPTIONS} />
          <Input type="number" {...form.register('warn_threshold')} />
        </div>
      </Field>
    </Fieldset>
  );
}
```

### 4. Legacy SP Pattern (Easy Migration)

**RULE: Keep legacy SP naming for easy migration path.**

Same SP structure as Flask app - routes to different SPs based on metric type:

```typescript
// checkService.ts - SP Routing (matches legacy check_routing_config.py)
const SP_ROUTING: Record<string, { create: string; update: string }> = {
  // Standard checks → sp_create_check / sp_update_check
  row_count: { create: 'sp_create_check', update: 'sp_update_check' },
  missing_count: { create: 'sp_create_check', update: 'sp_update_check' },
  duplicate_check: { create: 'sp_create_check', update: 'sp_update_check' },
  invalid_values: { create: 'sp_create_check', update: 'sp_update_check' },
  string_length: { create: 'sp_create_check', update: 'sp_update_check' },
  aggregation_metric: { create: 'sp_create_check', update: 'sp_update_check' },

  // Specialized checks → dedicated SPs (extension tables)
  freshness: { create: 'sp_create_freshness_check', update: 'sp_update_freshness_check' },
  schema: { create: 'sp_create_schema_check', update: 'sp_update_schema_check' },
  scalar_comparison: { create: 'sp_create_scalar_comparison_check', update: 'sp_update_scalar_comparison_check' },
  reference: { create: 'sp_create_reference_check', update: 'sp_update_reference_check' },
  custom_sql: { create: 'sp_create_custom_sql_check', update: 'sp_update_custom_sql_check' },
};

function getSpName(metric: string, operation: 'create' | 'update'): string {
  return SP_ROUTING[metric]?.[operation] ?? SP_ROUTING.row_count[operation];
}
```

**Why keep legacy pattern:**
- Same SP signatures as Flask app
- No changes needed to existing SPs
- Easy to migrate stored procedures directly
- Validation logic stays in each specialized SP

### 5. GraphQL Client with SP Routing

```typescript
// checkService.ts
export async function createCheck(data: CheckFormData): Promise<number> {
  const { metric, ...fields } = data;

  // Route to appropriate SP based on metric type
  const spName = getSpName(metric, 'create');

  // Build mutation dynamically
  const mutation = buildMutation(spName, fields);

  const result = await graphqlClient.request(mutation, fields);
  return result[`execute${spName}`][0].check_id;
}

// Example: Standard check mutation
// mutation { executesp_create_check(testcase_id: 1, ...) { check_id } }

// Example: Freshness check mutation
// mutation { executesp_create_freshness_check(testcase_id: 1, ..., freshness_column: "created_at") { check_id } }
```

**Mutation Examples:**

```graphql
# Standard check (row_count, missing_count, etc.)
mutation {
  executesp_create_check(
    testcase_id: 1,
    source_id: 1,
    schema_name: "dbo",
    table_name: "orders",
    check_name: "Order row count",
    metric: "row_count",
    fail_comparison: ">",
    fail_threshold: 0
  ) {
    check_id
  }
}

# Freshness check (extension table)
mutation {
  executesp_create_freshness_check(
    testcase_id: 1,
    source_id: 1,
    schema_name: "dbo",
    table_name: "orders",
    check_name: "Order freshness",
    freshness_column: "created_at",
    threshold_value: 24,
    threshold_unit: "hours"
  ) {
    check_id
  }
}
```

---

## Form State Management

### Option A: React Hook Form (Recommended)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checkSchema } from './checkSchema';

function useCheckForm(checkType: CheckType) {
  return useForm({
    resolver: zodResolver(checkSchema[checkType]),
    defaultValues: getDefaultValues(checkType),
  });
}
```

### Option B: useReducer (For complex state)

```typescript
function checkFormReducer(state, action) {
  switch (action.type) {
    case 'SET_CHECK_TYPE':
      return { ...getDefaultState(action.payload), checkType: action.payload };
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_SOURCE':
      return { ...state, source_id: action.payload, schema_name: null, table_name: null };
    // ... cascade resets
  }
}
```

---

## Cascading Dropdowns (Optimized)

### Legacy: 4 separate API calls on each change

### Fabric SDK: Batched GraphQL with caching

```typescript
// useCascadingDropdowns.ts
function useCascadingDropdowns(sourceId: number | null) {
  // Only fetch when source changes
  const { data: schemas, isLoading: schemasLoading } = useQuery(
    ['schemas', sourceId],
    () => fetchSchemas(sourceId),
    { enabled: !!sourceId, staleTime: 5 * 60 * 1000 } // Cache 5 min
  );

  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

  const { data: tables } = useQuery(
    ['tables', sourceId, selectedSchema],
    () => fetchTables(sourceId, selectedSchema),
    { enabled: !!sourceId && !!selectedSchema, staleTime: 5 * 60 * 1000 }
  );

  // ... columns

  return { schemas, tables, columns, selectedSchema, setSelectedSchema, ... };
}
```

---

## Component Structure

```
src/Workload/app/items/DQCheckerItem/
├── DQCheckerItemEditor.tsx         # Main editor (lifecycle)
├── components/
│   ├── CheckForm/
│   │   ├── CheckForm.tsx           # Main form orchestrator
│   │   ├── useCheckForm.ts         # Form state hook
│   │   ├── checkTypes.ts           # Check type configuration
│   │   ├── checkSchema.ts          # Zod validation schemas
│   │   ├── BaseFields.tsx          # Source, schema, table, name
│   │   ├── ColumnSelector.tsx      # Column dropdown (when needed)
│   │   ├── ThresholdFields.tsx     # Fail/warn thresholds
│   │   ├── FreshnessFields.tsx     # Freshness-specific
│   │   ├── SchemaValidationFields.tsx
│   │   ├── ScalarComparisonFields.tsx
│   │   └── CustomSqlFields.tsx
│   ├── CheckList/
│   │   ├── CheckList.tsx           # DataGrid of checks
│   │   └── CheckListItem.tsx       # Row component
│   └── shared/
│       └── CascadingDropdowns.tsx  # Reusable source→table selector
├── services/
│   ├── checkService.ts             # GraphQL mutations
│   └── metadataService.ts          # Schema/table/column queries
└── types/
    └── check.types.ts              # TypeScript interfaces
```

---

## Benefits of Optimized Approach

| Aspect | Legacy (Flask) | Fabric SDK |
|--------|----------------|------------|
| Template code | 1300+ lines | ~300 lines (config + renderer) |
| Check types | 22 hardcoded | Config-driven |
| Form validation | Alpine.js | Zod schemas (type-safe) |
| SP routing | Python code | TypeScript (same pattern) |
| SP naming | `sp_create_*`, `sp_update_*` | **Same** (easy migration) |
| State management | Alpine.js object | React Hook Form |
| API calls | 4 separate REST | Batched GraphQL + caching |
| Bundle size | Large | Smaller (shared components) |
| Adding new type | New template file | Add config entry |

---

## Migration Checklist

- [ ] Migrate legacy SPs to Fabric SQL DB (same signatures)
- [ ] Expose SPs in GraphQL API (`executesp_*`)
- [ ] Implement `checkTypes.ts` configuration
- [ ] Build reusable field components
- [ ] Implement `CheckForm.tsx` with dynamic rendering
- [ ] Add Zod validation schemas
- [ ] Test all 22 check types
