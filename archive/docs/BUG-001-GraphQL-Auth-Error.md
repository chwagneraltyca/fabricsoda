# BUG-001: GraphQL Test Connection Fails with Error 3

**Status:** FIXED (2026-01-05)
**Severity:** High
**Component:** Settings Page (DQCheckerItemSettings.tsx)
**Date:** 2026-01-05

## Root Cause Found

**The SPA redirect URI in Entra app was `/auth` but the code in index.ts expects `/close`.**

Both projects (Data Lineage and DQ Checker) have identical index.ts with:
```javascript
const redirectUriPath = '/close';
```

But the Entra app had `http://localhost:60006/auth` configured. This mismatch caused MSAL to fail with Error 3 (UnknownError) because the redirect URI didn't match.

## Fix Applied

Updated Entra app SPA redirect URIs via Graph API:
```bash
az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/applications/{object-id}" \
  --body '{"spa":{"redirectUris":[
    "http://localhost:60006/close",
    "https://app.fabric.microsoft.com/workloadSignIn/.../Org.DataLineage",
    "https://app.fabric.microsoft.com/workloadSignIn/.../Org.DQChecker"
  ]}}'
```

### Verified Configuration (After Fix)

```json
{
  "spa": [
    "http://localhost:60006/close",  // FIXED: was /auth
    "https://app.fabric.microsoft.com/workloadSignIn/.../Org.DQChecker",  // NEW
    "https://app.fabric.microsoft.com/workloadSignIn/.../Org.DataLineage"
  ]
}
```

---

## Original Issue

### Summary

The "Test Connection" button on the Settings page fails to acquire an access token with Error 3 (UnknownError) when attempting to authenticate with the Fabric GraphQL API.

### Error Message

```
Failed to acquire access token: {"error":3}
```

### Expected Behavior

The Test Connection should:
1. Acquire a bearer token via `workloadClient.auth.acquireFrontendAccessToken()`
2. Call the GraphQL endpoint with `Authorization: Bearer <token>`
3. Display success or GraphQL-specific errors

### Technical Analysis

#### Entra App Configuration (Before Fix)

| Property | Value |
|----------|-------|
| **App ID** | `bdfe868d-343c-4513-b65e-90ef18ed501c` |
| **Display Name** | `Org.DataLineage` |
| **Sign-in Audience** | AzureADMultipleOrgs |

**Identifier URIs:**
```
api://localdevinstance/815346c3-f673-44a6-9e96-5c0103c94235/Org.DQChecker/Hnj  (CORRECT)
api://localdevinstance/815346c3-f673-44a6-9e96-5c0103c94235/Org.DataLineage/Hnj
api://chwagner.eu/815346c3-f673-44a6-9e96-5c0103c94235/Org.DataLineage
```

**SPA Redirect URIs (BEFORE - INCORRECT):**
```
https://app.fabric.microsoft.com/workloadSignIn/815346c3-f673-44a6-9e96-5c0103c94235/Org.DataLineage
http://localhost:60006/auth  <-- WRONG! Should be /close
```

### .env Configuration (DQ Checker)

```
DEV_AAD_CONFIG_AUDIENCE=api://localdevinstance/815346c3-f673-44a6-9e96-5c0103c94235/Org.DQChecker/Hnj
DEV_AAD_CONFIG_APPID=bdfe868d-343c-4513-b65e-90ef18ed501c
```

### Code Path

```typescript
// DQCheckerItemSettings.tsx:handleTestConnection()
const authService = new FabricAuthenticationService(workloadClient);
const tokenResult = await authService.acquireAccessToken(FABRIC_BASE_SCOPES.POWERBI_API);
// ^^^ Fails here with Error 3

// FabricAuthenticationService.ts
const result = await this.workloadClient.auth.acquireFrontendAccessToken({
    scopes: ['https://analysis.windows.net/powerbi/api/.default']
});
```

### Comparison with Working Data Lineage Project

Data Lineage uses **identical** authentication code (same FabricAuthenticationService, same scopes) and works correctly. The difference:
- Data Lineage item manifest references `Org.DataLineage`
- DQ Checker item manifest references `Org.DQChecker`

## Root Cause Investigation

### Hypothesis 1: Missing SPA Redirect URI for DQ Checker

The Entra app SPA redirect URIs only include DataLineage:
```
https://app.fabric.microsoft.com/workloadSignIn/.../Org.DataLineage
```

Missing:
```
https://app.fabric.microsoft.com/workloadSignIn/.../Org.DQChecker
```

**Counter-argument:** For local dev (`http://localhost:60006`), the redirect should be `http://localhost:60006/auth` which IS configured. Production Fabric URIs shouldn't matter for devserver.

### Hypothesis 2: Workload Name Mismatch

The Entra app is named "Org.DataLineage" but we're running "Org.DQChecker". However, the identifier URI for DQChecker IS present, so this should work.

### Hypothesis 3: Token Audience Configuration

The `acquireFrontendAccessToken` API may use the workload's audience URI to determine which app registration to use. If Fabric can't match `Org.DQChecker` to the Entra app, it fails.

### Hypothesis 4: User Consent Not Granted

The user may need to re-consent after adding the DQChecker identifier URI.

## Recommended Actions

### Option A: Verify Local Dev Setup
1. Check DevGateway console for authentication errors
2. Check browser console (F12) for MSAL errors
3. Verify the workload is registered correctly

### Option B: Add Missing SPA Redirect URI
```bash
az ad app update --id bdfe868d-343c-4513-b65e-90ef18ed501c \
  --spa-redirect-uris \
    "http://localhost:60006/auth" \
    "https://app.fabric.microsoft.com/workloadSignIn/815346c3-f673-44a6-9e96-5c0103c94235/Org.DataLineage" \
    "https://app.fabric.microsoft.com/workloadSignIn/815346c3-f673-44a6-9e96-5c0103c94235/Org.DQChecker"
```

### Option C: Re-consent to Application

Navigate to admin consent URL:
```
https://login.microsoftonline.com/815346c3-f673-44a6-9e96-5c0103c94235/adminconsent?client_id=bdfe868d-343c-4513-b65e-90ef18ed501c
```

### Option D: Verify Scopes Are Not Required

Per MS documentation, for initial token acquisition you can use empty scopes:
```typescript
const token = await workloadClient.auth.acquireFrontendAccessToken({ scopes: [] });
```

Then use that token for GraphQL (which should work since GraphQL requires `https://analysis.windows.net/powerbi/api` resource).

## Files Involved

- [DQCheckerItemSettings.tsx](../../src/Workload/app/items/DQCheckerItem/DQCheckerItemSettings.tsx:272-309) - handleTestConnection()
- [FabricAuthenticationService.ts](../../src/Workload/app/clients/FabricAuthenticationService.ts) - acquireAccessToken()
- [FabricPlatformScopes.ts](../../src/Workload/app/clients/FabricPlatformScopes.ts) - POWERBI_API scope
- [.env](../../src/Workload/.env) - DEV_AAD_CONFIG_* settings

## References

- [Fabric Authentication JavaScript API](https://learn.microsoft.com/en-us/fabric/workload-development-kit/authentication-javascript-api)
- [FET Authentication Overview](https://learn.microsoft.com/en-us/fabric/extensibility-toolkit/authentication-overview)
- [CreateDevAADApp.ps1](../../scripts/Setup/CreateDevAADApp.ps1) - App registration script
