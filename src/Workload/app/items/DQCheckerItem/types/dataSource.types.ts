/**
 * Data Source Types
 *
 * TypeScript interfaces for data sources matching the ER model.
 * Field names match the dq_sources table exactly.
 *
 * See: docs/specs/data-model/er-model-simplified.md
 */

// Source type options (matches ER model)
export type SourceType = 'fabric_warehouse' | 'fabric_sqldb' | 'spark_sql' | 'azure_sql';

// Source type display options
export const sourceTypeOptions: { value: SourceType; label: string; description: string }[] = [
  { value: 'fabric_warehouse', label: 'Fabric Warehouse', description: 'Microsoft Fabric Data Warehouse' },
  { value: 'fabric_sqldb', label: 'Fabric SQL DB', description: 'Microsoft Fabric SQL Database' },
  { value: 'azure_sql', label: 'Azure SQL', description: 'Azure SQL Database' },
  { value: 'spark_sql', label: 'Spark SQL', description: 'Spark SQL endpoint' },
];

// Data source from database (matches ER model)
export interface DataSource {
  source_id: number;
  source_name: string;
  source_type: SourceType;
  server_name: string;
  database_name: string;
  keyvault_uri: string | null;   // Azure Key Vault URI (optional, for per-source KV)
  client_id: string | null;       // Service Principal client ID (optional)
  secret_name: string | null;     // Key Vault secret name (optional)
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Form data for create/update
export interface DataSourceFormData {
  source_name: string;
  source_type: SourceType;
  server_name: string;
  database_name: string;
  keyvault_uri?: string;
  client_id?: string;
  secret_name?: string;
  description?: string;
  is_active: boolean;
}

// GraphQL query response
export interface DataSourcesQueryResponse {
  dq_sources: {
    items: DataSource[];
  };
}

// GraphQL mutation response (create)
export interface CreateDataSourceResponse {
  createDq_sources: {
    source_id: number;
    source_name: string;
  };
}

// GraphQL mutation response (update)
export interface UpdateDataSourceResponse {
  updateDq_sources: {
    source_id: number;
    source_name: string;
  };
}

// GraphQL mutation response (delete)
export interface DeleteDataSourceResponse {
  deleteDq_sources: {
    source_id: number;
  };
}

// Connection test status
export type ConnectionStatus = 'idle' | 'checking' | 'success' | 'error';

// Connection test result
export interface ConnectionTestResult {
  status: ConnectionStatus;
  message?: string;
  serverInfo?: {
    version: string;
    database: string;
  };
}

// Validation rules
export const dataSourceValidation = {
  source_name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[\w\s\-_.]+$/,
    message: 'Source name must be 1-100 characters (letters, numbers, spaces, hyphens, underscores)',
  },
  server_name: {
    required: true,
    minLength: 1,
    maxLength: 255,
    message: 'Server name is required (Fabric SQL endpoint)',
  },
  database_name: {
    required: true,
    minLength: 1,
    maxLength: 128,
    message: 'Database/artifact name is required',
  },
  keyvault_uri: {
    required: false,
    maxLength: 500,
    pattern: /^https:\/\/[\w-]+\.vault\.azure\.net\/?$/,
    message: 'Must be a valid Key Vault URI (https://name.vault.azure.net/)',
  },
  client_id: {
    required: false,
    maxLength: 100,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    message: 'Must be a valid GUID format',
  },
  secret_name: {
    required: false,
    maxLength: 128,
    pattern: /^[a-zA-Z][a-zA-Z0-9-]*$/,
    message: 'Secret name must start with a letter and contain only letters, numbers, and hyphens',
  },
  description: {
    required: false,
    maxLength: 500,
  },
};

// Form default values
export const defaultDataSourceFormData: DataSourceFormData = {
  source_name: '',
  source_type: 'fabric_warehouse',
  server_name: '',
  database_name: '',
  keyvault_uri: '',
  client_id: '',
  secret_name: '',
  description: '',
  is_active: true,
};
