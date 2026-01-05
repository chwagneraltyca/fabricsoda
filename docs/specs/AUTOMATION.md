# DQ Checker - Automation Specification

**Version:** 2.0
**Last Updated:** 2026-01-05

---

## Overview

All DQ Checker automation uses existing PowerShell scripts:

| Tool | Purpose |
|------|---------|
| **sqlcmd** | Database operations (schema deploy, queries) |
| **az CLI** | Azure authentication, Key Vault operations |
| **Fabric REST API** | Notebook upload, execution, status monitoring |

**NO LOCAL PYTHON.** All Python execution happens in Fabric notebooks only.

---

## Quick Reference

### Full Integration Test (Recommended)

```powershell
# Run complete test with all steps
./scripts/Test/full-test.ps1 -All

# Run only notebook and verify (test data already exists)
./scripts/Test/full-test.ps1 -RunNotebook -VerifyResults -TestcaseId 2

# Deploy schema + test data without running notebook
./scripts/Test/full-test.ps1 -DeploySchema -SetupTestData
```

### Individual Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/Deploy/run-migration.ps1` | Run SQL against DB | `-MigrationFile "path/to/file.sql"` |
| `scripts/Deploy/upload-notebook-api.ps1` | Upload notebook to Fabric | (no params) |
| `scripts/Run/run-dq-checker.ps1` | Run dq_checker_scan | (no params, monitors until complete) |
| `scripts/Run/run-smoke-test.ps1` | Run smoke_test notebook | (no params) |
| `scripts/Deploy/list-notebooks.ps1` | List notebooks in workspace | (no params) |

---

## Automation Scripts Inventory

### Deploy Scripts (`scripts/Deploy/`)

| Script | Description |
|--------|-------------|
| `run-migration.ps1` | Execute SQL file via sqlcmd with Service Principal auth |
| `upload-notebook-api.ps1` | Upload/update dq_checker_scan.ipynb to Fabric |
| `list-notebooks.ps1` | List all notebooks in workspace |
| `delete-notebook.ps1` | Delete a notebook by name |
| `add-keyvault-secrets.ps1` | Add required secrets to Key Vault |
| `grant-kv-access.ps1` | Grant Key Vault access to Fabric runtime |
| `setup-test-data.sql` | Insert test data (source, suite, testcase, check) |
| `verify-results.sql` | Query results after notebook execution |

### Run Scripts (`scripts/Run/`)

| Script | Description |
|--------|-------------|
| `run-dq-checker.ps1` | Execute dq_checker_scan notebook and monitor |
| `run-smoke-test.ps1` | Execute smoke_test notebook and monitor |
| `check-job-status.ps1` | Check status of a running job |

### Test Scripts (`scripts/Test/`)

| Script | Description |
|--------|-------------|
| `full-test.ps1` | **Master orchestration script** - combines all steps |

---

## Workflows

### 1. First-Time Setup

```powershell
# 1. Configure environment
cp .env.example .env
# Edit .env with your values

# 2. Deploy database schema
./scripts/Deploy/run-migration.ps1 -MigrationFile "setup/simplified-schema-minimal-ddl.sql"

# 3. Add Key Vault secrets
./scripts/Deploy/add-keyvault-secrets.ps1

# 4. Upload notebook to Fabric
./scripts/Deploy/upload-notebook-api.ps1

# 5. Setup test data
./scripts/Deploy/run-migration.ps1 -MigrationFile "scripts/Deploy/setup-test-data.sql"
```

### 2. Development Workflow

```powershell
# After making changes to notebook:
./scripts/Deploy/upload-notebook-api.ps1

# Run integration test:
./scripts/Test/full-test.ps1 -RunNotebook -VerifyResults -TestcaseId 2
```

### 3. Full Integration Test

```powershell
# Run everything from scratch:
./scripts/Test/full-test.ps1 -All

# This executes:
# 1. Deploy schema (if -DeploySchema)
# 2. Setup test data (if -SetupTestData)
# 3. Upload notebook (if -UploadNotebook)
# 4. Run notebook with TestcaseId parameter
# 5. Verify results in database
```

### 4. CI/CD Pipeline

```powershell
# Example Azure DevOps / GitHub Actions step:
pwsh -File scripts/Test/full-test.ps1 -UploadNotebook -RunNotebook -VerifyResults -TestcaseId 2
```

---

## Environment Variables

Required in `.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `AZURE_CLIENT_ID` | Service Principal client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_SECRET` | Service Principal secret | `xxxxx~xxxxx` |
| `AZURE_TENANT_ID` | Azure AD tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `DQ_SQL_SERVER` | Fabric SQL DB endpoint | `xxx.datawarehouse.fabric.microsoft.com` |
| `DQ_SQL_DATABASE` | Metadata database name | `dq_checker_meta` |
| `DQ_WORKSPACE_ID` | Fabric workspace GUID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

---

## Test Data

The `scripts/Deploy/setup-test-data.sql` creates:

| Entity | ID | Name |
|--------|-----|------|
| Data Source | 4 | `sample_dwh` |
| Suite | 2 | `DQ_TEST` |
| Testcase | 2 | `System Tables Check` |
| Check | 2 | `row_count > 0` |

---

## Fabric REST API Reference

### Authentication

```powershell
# Get access token for Fabric API
$body = @{
    grant_type = "client_credentials"
    client_id = $env:AZURE_CLIENT_ID
    client_secret = $env:AZURE_CLIENT_SECRET
    scope = "https://api.fabric.microsoft.com/.default"
}
$tokenResponse = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$env:AZURE_TENANT_ID/oauth2/v2.0/token" -Method Post -Body $body
$token = $tokenResponse.access_token
```

### Endpoints

| Operation | Method | URL |
|-----------|--------|-----|
| List items | GET | `/v1/workspaces/{workspaceId}/items` |
| Create item | POST | `/v1/workspaces/{workspaceId}/items` |
| Update notebook | POST | `/v1/workspaces/{workspaceId}/items/{itemId}/updateDefinition` |
| Run notebook | POST | `/v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances?jobType=RunNotebook` |
| Get job status | GET | `{locationHeader}` (from run response) |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| sqlcmd not found | Install [SQLCMD utility](https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility) |
| Token acquisition failed | Check Service Principal credentials in .env |
| Notebook not found | Run `./scripts/Deploy/upload-notebook-api.ps1` first |
| Permission denied | Verify SPN has Contributor role on workspace |
| Key Vault access denied | Run `./scripts/Deploy/grant-kv-access.ps1` |

---

## Important Rules

1. **No local Python** - All Python runs in Fabric notebooks only
2. **No pip install locally** - Dependencies are managed in Fabric runtime
3. **Use existing scripts** - Don't create new automation, use the inventory above
4. **Environment in .env** - Never hardcode credentials in scripts

---

## References

- [Fabric REST API](https://learn.microsoft.com/en-us/rest/api/fabric/core/items)
- [Run Notebook API](https://learn.microsoft.com/en-us/rest/api/fabric/notebook/items/run-on-demand-item-job)
- [sqlcmd Documentation](https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility)
