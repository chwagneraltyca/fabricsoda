/**
 * Source Types (OneLake JSON)
 *
 * Data source connection configuration stored as JSON in OneLake.
 * Uses UUID as primary key (frontend-generated).
 *
 * Storage: Files/config/data/sources/{uuid}.json
 */

// Source type options
export type SourceType = 'fabric_warehouse' | 'fabric_sqldb' | 'spark_sql' | 'azure_sql';

// Source type display options
export const sourceTypeOptions: { value: SourceType; label: string; description: string }[] = [
  { value: 'fabric_warehouse', label: 'Fabric Warehouse', description: 'Microsoft Fabric Data Warehouse' },
  { value: 'fabric_sqldb', label: 'Fabric SQL DB', description: 'Microsoft Fabric SQL Database' },
  { value: 'azure_sql', label: 'Azure SQL', description: 'Azure SQL Database' },
  { value: 'spark_sql', label: 'Spark SQL', description: 'Spark SQL endpoint' },
];

/**
 * Source entity (stored as JSON file)
 */
export interface Source {
  source_id: string;           // UUID (filename)
  source_name: string;
  source_type: SourceType;
  server_name: string;         // Fabric SQL endpoint
  database_name: string;       // Artifact/database name
  keyvault_uri: string | null; // Azure Key Vault URI (optional)
  client_id: string | null;    // Service Principal client ID (optional)
  secret_name: string | null;  // Key Vault secret name (optional)
  description: string | null;
  is_active: boolean;
  created_at: string;          // ISO timestamp
  version: string;             // ISO timestamp (optimistic locking)
}

/**
 * Input for creating a source
 */
export interface SourceInput {
  source_name: string;
  source_type: SourceType;
  server_name: string;
  database_name: string;
  keyvault_uri?: string;
  client_id?: string;
  secret_name?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Input for updating a source
 */
export interface SourceUpdate extends Partial<SourceInput> {
  version?: string;  // For optimistic locking
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

// Form default values
export const defaultSourceInput: SourceInput = {
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
