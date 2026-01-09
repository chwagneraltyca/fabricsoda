/**
 * DQ Checker GraphQL Client
 *
 * Client for calling the Fabric GraphQL API from the workload frontend.
 * Uses the WorkloadClientAPI for authentication.
 *
 * Pattern (from Data Lineage reference):
 * - Endpoint comes from item definition (settings), NOT from process.env
 * - Initialize with initGraphQLClient(workloadClient, endpoint)
 * - Endpoint is stored in Fabric item definition and configured via Settings page
 *
 * Flow: User configures endpoint in Settings → Saved to item definition →
 *       Editor loads definition → Passes endpoint to initGraphQLClient
 */

import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { FabricAuthenticationService } from '../../../clients/FabricAuthenticationService';
import { FABRIC_BASE_SCOPES } from '../../../clients/FabricPlatformScopes';

// GraphQL response types
export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export interface GraphQLError extends Error {
  graphqlErrors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

/**
 * DQ Checker GraphQL Client
 *
 * Provides typed methods for querying and mutating DQ Checker data.
 * Uses Fabric workload SDK authentication.
 *
 * IMPORTANT: Endpoint must be provided - it comes from item definition (settings).
 * Configure endpoint in Settings page, not environment variables.
 */
export class GraphQLClient {
  private authService: FabricAuthenticationService;
  private endpoint: string;

  constructor(workloadClient: WorkloadClientAPI, endpoint?: string) {
    this.authService = new FabricAuthenticationService(workloadClient);
    this.endpoint = endpoint || '';

    if (!this.endpoint) {
      console.warn('[GraphQLClient] No endpoint provided. Configure GraphQL endpoint in Settings.');
    }
  }

  /**
   * Execute a GraphQL query/mutation
   *
   * @param query GraphQL query string
   * @param variables Optional variables object
   * @returns Promise with typed response data
   * @throws GraphQLError if the request fails or returns errors
   */
  async execute<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    // Check endpoint is configured
    if (!this.endpoint) {
      throw new Error(
        'GraphQL endpoint not configured. ' +
        'Open Settings (gear icon) and configure the GraphQL Endpoint URL, then save and reload.'
      );
    }

    // Acquire token for GraphQL API
    const token = await this.authService.acquireAccessToken(FABRIC_BASE_SCOPES.POWERBI_API);

    // Execute GraphQL request
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.token}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    // Check for GraphQL errors
    if (result.errors && result.errors.length > 0) {
      const error = new Error(result.errors.map(e => e.message).join(', ')) as GraphQLError;
      error.graphqlErrors = result.errors;
      throw error;
    }

    if (!result.data) {
      throw new Error('GraphQL response missing data');
    }

    return result.data;
  }

  /**
   * Execute a query (alias for execute, semantic clarity)
   */
  async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.execute<T>(query, variables);
  }

  /**
   * Execute a mutation (alias for execute, semantic clarity)
   */
  async mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<T> {
    return this.execute<T>(mutation, variables);
  }
}

// Singleton instance (set when workloadClient is available)
let clientInstance: GraphQLClient | null = null;

/**
 * Initialize the GraphQL client with the workload client
 *
 * Call this once when the workload starts, before using getGraphQLClient()
 */
export function initGraphQLClient(workloadClient: WorkloadClientAPI, endpoint?: string): GraphQLClient {
  clientInstance = new GraphQLClient(workloadClient, endpoint);
  return clientInstance;
}

/**
 * Get the initialized GraphQL client
 *
 * @throws Error if client hasn't been initialized
 */
export function getGraphQLClient(): GraphQLClient {
  if (!clientInstance) {
    throw new Error('GraphQL client not initialized. Call initGraphQLClient() first.');
  }
  return clientInstance;
}
