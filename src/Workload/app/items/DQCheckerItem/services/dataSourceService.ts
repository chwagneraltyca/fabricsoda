/**
 * Data Source Service
 *
 * Service layer for data source CRUD operations via GraphQL.
 * Uses SP-backed mutations (executesp_create_data_source, executesp_update_data_source, etc.)
 * per spec: docs/specs/items/DQCheckerItem.md - ALL mutations use SP pattern.
 *
 * Schema: docs/specs/data-model/er-model-simplified.md
 */

import { getGraphQLClient } from './graphqlClient';
import {
  DataSource,
  DataSourceFormData,
  DataSourcesQueryResponse,
} from '../types/dataSource.types';

// All fields for dq_sources
const DATA_SOURCE_FIELDS = `
  source_id
  source_name
  source_type
  server_name
  database_name
  keyvault_uri
  client_id
  secret_name
  description
  is_active
  created_at
  updated_at
`;

// GraphQL Queries
const QUERIES = {
  // List all data sources
  listDataSources: `
    query ListDataSources($activeOnly: Boolean) {
      dq_sources(
        filter: { is_active: { eq: $activeOnly } }
        orderBy: { source_name: ASC }
      ) {
        items {
          ${DATA_SOURCE_FIELDS}
        }
      }
    }
  `,

  // List all data sources (no filter)
  listAllDataSources: `
    query ListAllDataSources {
      dq_sources(orderBy: { source_name: ASC }) {
        items {
          ${DATA_SOURCE_FIELDS}
        }
      }
    }
  `,

  // Get single data source
  getDataSource: `
    query GetDataSource($sourceId: Int!) {
      dq_sources(filter: { source_id: { eq: $sourceId } }) {
        items {
          ${DATA_SOURCE_FIELDS}
        }
      }
    }
  `,
};

// GraphQL Mutations (SP-backed per spec - NO auto-generated mutations)
const MUTATIONS = {
  // Create data source via SP
  createDataSource: `
    mutation CreateDataSource(
      $source_name: String!,
      $source_type: String,
      $server_name: String,
      $database_name: String,
      $keyvault_uri: String,
      $client_id: String,
      $secret_name: String,
      $description: String,
      $is_active: Boolean
    ) {
      executesp_create_data_source(
        source_name: $source_name,
        source_type: $source_type,
        server_name: $server_name,
        database_name: $database_name,
        keyvault_uri: $keyvault_uri,
        client_id: $client_id,
        secret_name: $secret_name,
        description: $description,
        is_active: $is_active
      ) {
        source_id
        source_name
      }
    }
  `,

  // Update data source via SP
  updateDataSource: `
    mutation UpdateDataSource(
      $source_id: Int!,
      $source_name: String!,
      $source_type: String,
      $server_name: String,
      $database_name: String,
      $keyvault_uri: String,
      $client_id: String,
      $secret_name: String,
      $description: String,
      $is_active: Boolean
    ) {
      executesp_update_data_source(
        source_id: $source_id,
        source_name: $source_name,
        source_type: $source_type,
        server_name: $server_name,
        database_name: $database_name,
        keyvault_uri: $keyvault_uri,
        client_id: $client_id,
        secret_name: $secret_name,
        description: $description,
        is_active: $is_active
      ) {
        source_id
        source_name
      }
    }
  `,

  // Delete data source via SP
  deleteDataSource: `
    mutation DeleteDataSource($source_id: Int!) {
      executesp_delete_data_source(source_id: $source_id) {
        deleted_count
      }
    }
  `,
};

// SP response types
interface SPCreateResponse {
  executesp_create_data_source: {
    source_id: number;
    source_name: string;
  };
}

interface SPUpdateResponse {
  executesp_update_data_source: {
    source_id: number;
    source_name: string;
  };
}

interface SPDeleteResponse {
  executesp_delete_data_source: {
    deleted_count: number;
  };
}

/**
 * Data Source Service
 *
 * Provides CRUD operations for data sources via SP-backed mutations.
 */
export const dataSourceService = {
  /**
   * List all data sources
   *
   * @param activeOnly If true, only return active sources
   * @returns Array of DataSource objects
   */
  async list(activeOnly?: boolean): Promise<DataSource[]> {
    const client = getGraphQLClient();

    const query = activeOnly !== undefined
      ? QUERIES.listDataSources
      : QUERIES.listAllDataSources;

    const variables = activeOnly !== undefined ? { activeOnly } : undefined;
    const response = await client.query<DataSourcesQueryResponse>(query, variables);

    return response.dq_sources.items;
  },

  /**
   * Get a single data source by ID
   *
   * @param sourceId The source ID
   * @returns DataSource object or null if not found
   */
  async get(sourceId: number): Promise<DataSource | null> {
    const client = getGraphQLClient();
    const response = await client.query<DataSourcesQueryResponse>(QUERIES.getDataSource, {
      sourceId,
    });

    const items = response.dq_sources.items;
    return items.length > 0 ? items[0] : null;
  },

  /**
   * Create a new data source via SP
   *
   * @param data DataSourceFormData
   * @returns Created DataSource with source_id
   */
  async create(data: DataSourceFormData): Promise<{ source_id: number; source_name: string }> {
    const client = getGraphQLClient();
    const response = await client.mutate<SPCreateResponse>(MUTATIONS.createDataSource, {
      source_name: data.source_name,
      source_type: data.source_type || 'fabric_warehouse',
      server_name: data.server_name || null,
      database_name: data.database_name || null,
      keyvault_uri: data.keyvault_uri || null,
      client_id: data.client_id || null,
      secret_name: data.secret_name || null,
      description: data.description || null,
      is_active: data.is_active,
    });

    return response.executesp_create_data_source;
  },

  /**
   * Update an existing data source via SP
   *
   * @param sourceId The source ID to update
   * @param data DataSourceFormData with updated values
   * @returns Updated source_id and source_name
   */
  async update(sourceId: number, data: DataSourceFormData): Promise<{ source_id: number; source_name: string }> {
    const client = getGraphQLClient();
    const response = await client.mutate<SPUpdateResponse>(MUTATIONS.updateDataSource, {
      source_id: sourceId,
      source_name: data.source_name,
      source_type: data.source_type || null,
      server_name: data.server_name || null,
      database_name: data.database_name || null,
      keyvault_uri: data.keyvault_uri || null,
      client_id: data.client_id || null,
      secret_name: data.secret_name || null,
      description: data.description || null,
      is_active: data.is_active,
    });

    return response.executesp_update_data_source;
  },

  /**
   * Delete a data source via SP
   *
   * @param sourceId The source ID to delete
   * @returns The deleted count
   */
  async delete(sourceId: number): Promise<{ deleted_count: number }> {
    const client = getGraphQLClient();
    const response = await client.mutate<SPDeleteResponse>(MUTATIONS.deleteDataSource, {
      source_id: sourceId,
    });

    return response.executesp_delete_data_source;
  },

  /**
   * Toggle data source active status
   *
   * @param sourceId The source ID
   * @param currentStatus Current is_active status
   * @returns Updated source info
   */
  async toggleStatus(sourceId: number, currentStatus: boolean): Promise<{ source_id: number; source_name: string }> {
    // Get current source details first
    const source = await this.get(sourceId);
    if (!source) {
      throw new Error(`Data source ${sourceId} not found`);
    }

    // Update with toggled status
    return this.update(sourceId, {
      source_name: source.source_name,
      source_type: source.source_type,
      server_name: source.server_name,
      database_name: source.database_name,
      keyvault_uri: source.keyvault_uri || undefined,
      client_id: source.client_id || undefined,
      secret_name: source.secret_name || undefined,
      description: source.description || undefined,
      is_active: !currentStatus,
    });
  },
};
