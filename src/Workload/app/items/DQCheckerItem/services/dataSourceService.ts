/**
 * Data Source Service
 *
 * Service layer for data source CRUD operations via GraphQL.
 * Uses SP-backed mutations (executesp_*) as per project rules.
 *
 * GraphQL Pattern:
 * - Reads: Direct queries against dq_sources table
 * - Writes: SP-backed mutations (executesp_create_data_source, etc.)
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

// GraphQL Queries
const QUERIES = {
  // List all data sources (matches legacy /api/data-sources GET)
  listDataSources: `
    query ListDataSources($activeOnly: Boolean) {
      dq_sources(
        filter: { is_active: { eq: $activeOnly } }
        orderBy: { source_name: ASC }
      ) {
        items {
          source_id
          source_name
          description
          is_active
          created_at
          updated_at
        }
      }
    }
  `,

  // Get single data source (matches legacy /api/data-sources/:id GET)
  getDataSource: `
    query GetDataSource($sourceId: Int!) {
      dq_sources(filter: { source_id: { eq: $sourceId } }) {
        items {
          source_id
          source_name
          description
          is_active
          created_at
          updated_at
        }
      }
    }
  `,
};

// GraphQL Mutations (SP-backed as per CLAUDE.md Rule #6)
const MUTATIONS = {
  // Create data source via sp_create_data_source
  createDataSource: `
    mutation CreateDataSource(
      $source_name: String!
      $description: String
      $is_active: Boolean
    ) {
      executesp_create_data_source(
        source_name: $source_name
        description: $description
        is_active: $is_active
      ) {
        source_id
        source_name
        description
        is_active
      }
    }
  `,

  // Update data source via sp_update_data_source
  updateDataSource: `
    mutation UpdateDataSource(
      $source_id: Int!
      $source_name: String!
      $description: String
      $is_active: Boolean
    ) {
      executesp_update_data_source(
        source_id: $source_id
        source_name: $source_name
        description: $description
        is_active: $is_active
      ) {
        source_id
        source_name
        description
        is_active
      }
    }
  `,

  // Delete data source via sp_delete_data_source
  deleteDataSource: `
    mutation DeleteDataSource($source_id: Int!) {
      executesp_delete_data_source(source_id: $source_id) {
        deleted_count
      }
    }
  `,
};

/**
 * Data Source Service
 *
 * Provides CRUD operations for data sources matching the legacy Flask API.
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

    // Note: GraphQL filter with null value means "all"
    // We need to build the query differently based on activeOnly
    const query = activeOnly !== undefined
      ? QUERIES.listDataSources
      : `
        query ListAllDataSources {
          dq_sources(orderBy: { source_name: ASC }) {
            items {
              source_id
              source_name
              description
              is_active
              created_at
              updated_at
            }
          }
        }
      `;

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
  async create(data: DataSourceFormData): Promise<DataSource> {
    const client = getGraphQLClient();
    const response = await client.mutate<CreateDataSourceResponse>(MUTATIONS.createDataSource, {
      source_name: data.source_name,
      description: data.description || null,
      is_active: data.is_active,
    });

    const result = response.executesp_create_data_source[0];
    return {
      ...result,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  /**
   * Update an existing data source
   *
   * @param sourceId The source ID to update
   * @param data DataSourceFormData with updated values
   * @returns Updated DataSource
   */
  async update(sourceId: number, data: DataSourceFormData): Promise<DataSource> {
    const client = getGraphQLClient();
    const response = await client.mutate<UpdateDataSourceResponse>(MUTATIONS.updateDataSource, {
      source_id: sourceId,
      source_name: data.source_name,
      description: data.description || null,
      is_active: data.is_active,
    });

    const result = response.executesp_update_data_source[0];
    return {
      ...result,
      created_at: '', // Not returned by update SP
      updated_at: new Date().toISOString(),
    };
  },

  /**
   * Delete a data source
   *
   * @param sourceId The source ID to delete
   * @returns true if deleted, false if not found
   */
  async delete(sourceId: number): Promise<boolean> {
    const client = getGraphQLClient();
    const response = await client.mutate<DeleteDataSourceResponse>(MUTATIONS.deleteDataSource, {
      source_id: sourceId,
    });

    return response.executesp_delete_data_source[0].deleted_count > 0;
  },

  /**
   * Toggle data source active status
   *
   * @param sourceId The source ID
   * @param currentStatus Current is_active status
   * @returns Updated DataSource
   */
  async toggleStatus(sourceId: number, currentStatus: boolean): Promise<DataSource> {
    // Get current source details first
    const source = await this.get(sourceId);
    if (!source) {
      throw new Error(`Data source ${sourceId} not found`);
    }

    // Update with toggled status
    return this.update(sourceId, {
      source_name: source.source_name,
      description: source.description || undefined,
      is_active: !currentStatus,
    });
  },
};
