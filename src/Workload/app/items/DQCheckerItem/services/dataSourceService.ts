/**
 * Data Source Service
 *
 * Service layer for data source CRUD operations via GraphQL.
 * Uses auto-generated mutations (createDq_sources, updateDq_sources, deleteDq_sources)
 * per CLAUDE.md - SPs are only for multi-table operations.
 *
 * Schema: docs/specs/data-model/er-model-simplified.md
 */

import { getGraphQLClient } from './graphqlClient';
import {
  DataSource,
  DataSourceFormData,
  DataSourcesQueryResponse,
  CreateDataSourceResponse,
  UpdateDataSourceResponse,
  DeleteDataSourceResponse,
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

// GraphQL Mutations (auto-generated per CLAUDE.md)
const MUTATIONS = {
  // Create data source via auto-generated mutation
  createDataSource: `
    mutation CreateDataSource($item: CreateDq_sourcesInput!) {
      createDq_sources(item: $item) {
        source_id
        source_name
      }
    }
  `,

  // Update data source via auto-generated mutation
  updateDataSource: `
    mutation UpdateDataSource($source_id: Int!, $item: UpdateDq_sourcesInput!) {
      updateDq_sources(source_id: $source_id, item: $item) {
        source_id
        source_name
      }
    }
  `,

  // Delete data source via auto-generated mutation
  deleteDataSource: `
    mutation DeleteDataSource($source_id: Int!) {
      deleteDq_sources(source_id: $source_id) {
        source_id
      }
    }
  `,
};

/**
 * Data Source Service
 *
 * Provides CRUD operations for data sources.
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
   * Create a new data source
   *
   * @param data DataSourceFormData
   * @returns Created DataSource with source_id
   */
  async create(data: DataSourceFormData): Promise<{ source_id: number; source_name: string }> {
    const client = getGraphQLClient();
    const response = await client.mutate<CreateDataSourceResponse>(MUTATIONS.createDataSource, {
      item: {
        source_name: data.source_name,
        source_type: data.source_type,
        server_name: data.server_name,
        database_name: data.database_name,
        keyvault_uri: data.keyvault_uri || null,
        client_id: data.client_id || null,
        secret_name: data.secret_name || null,
        description: data.description || null,
        is_active: data.is_active,
      },
    });

    return response.createDq_sources;
  },

  /**
   * Update an existing data source
   *
   * @param sourceId The source ID to update
   * @param data DataSourceFormData with updated values
   * @returns Updated source_id and source_name
   */
  async update(sourceId: number, data: DataSourceFormData): Promise<{ source_id: number; source_name: string }> {
    const client = getGraphQLClient();
    const response = await client.mutate<UpdateDataSourceResponse>(MUTATIONS.updateDataSource, {
      source_id: sourceId,
      item: {
        source_name: data.source_name,
        source_type: data.source_type,
        server_name: data.server_name,
        database_name: data.database_name,
        keyvault_uri: data.keyvault_uri || null,
        client_id: data.client_id || null,
        secret_name: data.secret_name || null,
        description: data.description || null,
        is_active: data.is_active,
      },
    });

    return response.updateDq_sources;
  },

  /**
   * Delete a data source
   *
   * @param sourceId The source ID to delete
   * @returns The deleted source_id
   */
  async delete(sourceId: number): Promise<{ source_id: number }> {
    const client = getGraphQLClient();
    const response = await client.mutate<DeleteDataSourceResponse>(MUTATIONS.deleteDataSource, {
      source_id: sourceId,
    });

    return response.deleteDq_sources;
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
