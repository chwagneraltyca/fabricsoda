# Archived GraphQL Files

These files were archived as part of the OneLake JSON migration (January 2026).

## Why Archived?

The GraphQL API for Fabric SQL Database has a **cold start problem**:
- First request after idle: 5-22 seconds
- Happens repeatedly (after 10+ minutes idle)
- By design: "API environment needs to be initialized internally during the first call"

This made CRUD operations feel sluggish for users.

## Replacement

These files are replaced by:
- `services/onelakeJsonService.ts` - Base OneLake file operations
- `services/sourceService.ts` - Source CRUD via JSON files
- `services/testcaseService.ts` - Testcase + Check CRUD via JSON files
- `services/suiteService.ts` - Suite CRUD via JSON files
- `context/DataContext.tsx` - Load-all-cache-in-memory pattern

## Performance Comparison

| Metric | GraphQL (Before) | OneLake JSON (After) |
|--------|------------------|----------------------|
| Cold start | 5-22 seconds | N/A |
| List operation | 100-500ms | <100ms |
| Create/Update | 500ms+ | <200ms |

## References

- [Fabric GraphQL Performance](https://learn.microsoft.com/en-us/fabric/data-engineering/api-graphql-performance)
- [Fabric Community Discussion](https://community.fabric.microsoft.com/t5/Data-Engineering/Fabric-Graphql-API-response-time/m-p/4072742)

## Files

- `graphqlClient.ts` - GraphQL client with token management
- `dataSourceService.ts` - Data source CRUD via GraphQL mutations
