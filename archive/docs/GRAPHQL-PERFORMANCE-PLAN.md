# GraphQL Performance Optimization Plan

## Architecture Context

This is a **frontend-only** Microsoft Fabric workload:
- React app running inside a **sandboxed iframe** in Fabric portal
- Direct GraphQL calls to Fabric SQL Database (no backend API layer)
- User authentication via Fabric SDK (`workloadClient.auth.acquireFrontendAccessToken`)
- Sandbox attributes: `allow-same-origin` and `allow-scripts`

## Problem Statement

The current GraphQL CRUD implementation has poor performance:
1. **Cold start latency** - First request takes several seconds (expected Fabric behavior)
2. **Per-operation delay** - Each mutation/query feels slow, no instant feedback
3. **No caching** - Every operation makes fresh network calls

## Root Cause Analysis

### Cold Start (Documented Fabric Behavior)

From Microsoft docs ([API for GraphQL Performance](https://learn.microsoft.com/en-us/fabric/data-engineering/api-graphql-performance)):
> "API for GraphQL doesn't use or consume capacity (CUs) when idle. The API environment needs to be initialized internally during the first call which takes a couple of extra seconds."

This is **not fixable at the client level** but can be mitigated with warm-up strategies.

### Per-Operation Slowness (Fixable)

Current implementation issues:
1. **No caching** - Plain fetch-based client, no response caching
2. **No optimistic updates** - UI waits for server response before updating
3. **Double-fetch on toggle** - `toggleStatus()` calls `get()` then `update()` (2 round trips)
4. **Full refetch after mutations** - `onRefresh()` reloads all data after every change

### NOT an Issue (Investigated)

- **Token caching** - Fabric SDK handles token lifecycle via MSAL. Do NOT add custom caching.

## Fabric iframe SDK Compatibility

### What WORKS in sandboxed iframe:
- **TanStack Query** - Uses in-memory React state (not localStorage)
- **React Context** - Standard React features work normally
- **fetch API** - Direct HTTP calls work with `allow-same-origin`

### What may NOT work:
- **localStorage/sessionStorage** - May be blocked when 3rd party cookies disabled
- **refetchOnWindowFocus** - Focus events may not fire properly in iframes
- **Custom token caching** - Conflicts with Fabric SDK's internal MSAL handling

## Solution: TanStack Query

**Why TanStack Query:**
- Lightweight (~5KB vs Apollo's ~40KB)
- Works with existing fetch-based client (no rewrite needed)
- Uses in-memory caching (iframe-compatible)
- Provides caching, optimistic updates, deduplication

**Key capabilities:**
- **Optimistic updates** - UI updates instantly, rollback on error
- **Stale-while-revalidate** - Show cached data immediately, refresh in background
- **Request deduplication** - Multiple components requesting same data = 1 request

## Implementation Steps

### 1. Install TanStack Query

```bash
npm install @tanstack/react-query
```

### 2. Create QueryClientProvider

**File:** `src/Workload/app/context/QueryClientContext.tsx`

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // Data fresh for 30s
      gcTime: 5 * 60 * 1000,     // Cache for 5 min
      retry: 1,
      refetchOnWindowFocus: false,  // Disable for iframe
      refetchOnMount: false,
    },
  },
});
```

### 3. Create Data Source Hooks

**File:** `src/Workload/app/items/DQCheckerItem/hooks/useDataSources.ts`

```tsx
export function useDataSources() {
  return useQuery({
    queryKey: ['dataSources'],
    queryFn: () => dataSourceService.list(),
  });
}

export function useCreateDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dataSourceService.create,
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ['dataSources'] });
      const previous = queryClient.getQueryData(['dataSources']);
      queryClient.setQueryData(['dataSources'], (old: DataSource[] | undefined) =>
        [...(old || []), { ...newData, source_id: -1 }]
      );
      return { previous };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(['dataSources'], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
    },
  });
}
```

### 4. Implement GraphQL Warm-up

**File:** `src/Workload/app/items/DQCheckerItem/hooks/useGraphQLWarmup.ts`

```tsx
export function useGraphQLWarmup() {
  useEffect(() => {
    const warmUp = async () => {
      try {
        await dataSourceService.list();
      } catch {
        // Ignore errors during warmup
      }
    };
    warmUp();

    // Keep warm every 4 minutes (before 5-min idle timeout)
    const interval = setInterval(warmUp, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}
```

### 5. Fix toggleStatus Double-Fetch

**File:** `src/Workload/app/items/DQCheckerItem/services/dataSourceService.ts`

Pass cached data instead of fetching:

```tsx
// Before (2 API calls):
async toggleStatus(sourceId, currentStatus) {
  const source = await this.get(sourceId);
  return this.update(sourceId, {...});
}

// After (1 API call):
async toggleStatus(sourceId, currentStatus, cachedSource: DataSource) {
  return this.update(sourceId, {
    ...cachedSource,
    is_active: !currentStatus,
  });
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@tanstack/react-query` |
| `src/Workload/app/context/QueryClientContext.tsx` | Query client setup |
| `src/Workload/app/context/index.ts` | Export QueryClientProvider |
| `src/Workload/app/items/DQCheckerItem/hooks/useDataSources.ts` | Query/mutation hooks |
| `src/Workload/app/items/DQCheckerItem/hooks/useGraphQLWarmup.ts` | Warmup logic |
| `src/Workload/app/items/DQCheckerItem/services/dataSourceService.ts` | Fix toggleStatus |
| `src/Workload/app/items/DQCheckerItem/DQCheckerItemEditor.tsx` | Add providers |
| `src/Workload/app/items/DQCheckerItem/components/DataSources/DataSourcesView.tsx` | Use hooks |

**NOT modified:**
- `graphqlClient.ts` - No token caching (Fabric SDK handles via MSAL)

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Cold start | 3-5s | Hidden with warmup |
| List load (cached) | ~500ms | <50ms |
| Create/Update | 500ms+ wait | Instant |
| Toggle status | 1000ms+ (2 calls) | Instant + 1 call |

## Conclusion: Backend Required?

**No, a backend is NOT required for snappy CRUD.**

The Fabric GraphQL API is fast enough (~100-300ms after warmup). The issues are:
1. No caching - unnecessary round-trips
2. No optimistic updates - UI waits for server

TanStack Query solves both without infrastructure changes.

**When would you need a backend?**
- Complex business logic not in stored procedures
- Real-time subscriptions (WebSocket)
- Cross-workload data aggregation
- Heavy computation before/after DB operations
