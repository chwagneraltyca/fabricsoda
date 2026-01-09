/**
 * Data Source UI Types
 *
 * Form-specific types for data source CRUD components.
 * Uses Source as base entity type.
 *
 * See: docs/specs/data-model/json-data-model.md
 */

import { Source, SourceType } from './source.types';

// Re-export Source as DataSource for UI component compatibility
export type DataSource = Source;

// Form data for create/update (subset of Source fields)
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
