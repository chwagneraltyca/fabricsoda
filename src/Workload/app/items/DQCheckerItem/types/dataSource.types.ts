/**
 * Data Source Types
 *
 * TypeScript interfaces for data sources matching the POC schema.
 * Field names match the dq_sources table exactly.
 */

// Data source from database
export interface DataSource {
  source_id: number;
  source_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Form data for create/update (matches SP parameters)
export interface DataSourceFormData {
  source_name: string;
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
  executesp_create_data_source: Array<{
    source_id: number;
    source_name: string;
    description: string | null;
    is_active: boolean;
  }>;
}

// GraphQL mutation response (update)
export interface UpdateDataSourceResponse {
  executesp_update_data_source: Array<{
    source_id: number;
    source_name: string;
    description: string | null;
    is_active: boolean;
  }>;
}

// GraphQL mutation response (delete)
export interface DeleteDataSourceResponse {
  executesp_delete_data_source: Array<{
    deleted_count: number;
  }>;
}

// Validation rules (mirrors legacy Pydantic DataSourceCreate)
export const dataSourceValidation = {
  source_name: {
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[\w\s\-_.]+$/,
    message: 'Source name must be 1-100 characters (letters, numbers, spaces, hyphens, underscores)',
  },
  description: {
    required: false,
    maxLength: 500,
  },
};

// Form default values
export const defaultDataSourceFormData: DataSourceFormData = {
  source_name: '',
  description: '',
  is_active: true,
};
