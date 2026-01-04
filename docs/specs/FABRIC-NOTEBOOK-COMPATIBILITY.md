# Fabric Python Notebook + Soda Core Compatibility

**Version:** 1.0
**Last Updated:** 2025-01-04
**Status:** Analysis Complete

---

## Executive Summary

DQ Checker can migrate to **Fabric Python Notebooks** (NOT PySpark) using `soda-core-fabric`. All 20 currently supported metrics are compatible with Fabric Data Warehouse.

**Key Decision:** Use Fabric Python Notebook (2-core VM), NOT PySpark Notebook.

---

## Platform Comparison

| Feature | Fabric Python Notebook | PySpark Notebook |
|---------|----------------------|------------------|
| **Startup Time** | ~5 seconds (starter pool) | 3-5 minutes |
| **Compute** | 2-core lightweight VM | Spark cluster (4+ vCores) |
| **Cost** | Lower | Higher |
| **pip install** | Supported | Supported |
| **ODBC Driver 18** | Available | Available |
| **soda-core-fabric** | Compatible | Overkill |

**Recommendation:** Python Notebook is ideal for Soda Core execution - it's fast, cheap, and sufficient.

---

## Soda Core Fabric Installation

```python
# Cell 1: Install soda-core-fabric
%pip install soda-core-fabric azure-identity

# Restart kernel after install
import notebookutils
notebookutils.session.restartPython()
```

---

## Check Type Compatibility Matrix

### Fully Supported (20 Metrics)

| Category | Metric | Fabric DWH | Notes |
|----------|--------|------------|-------|
| **Completeness** | `row_count` | **YES** | |
| | `missing_count` | **YES** | |
| | `missing_percent` | **YES** | |
| **Accuracy** | `min` | **YES** | |
| | `max` | **YES** | |
| | `avg` | **YES** | |
| | `sum` | **YES** | |
| **Uniqueness** | `duplicate_count` | **YES** | |
| | `duplicate_percent` | **YES** | |
| **Validity** | `invalid_count` | **YES** | Regex limited (see below) |
| | `invalid_percent` | **YES** | Regex limited |
| | `valid_count` | **YES** | Regex limited |
| **String** | `avg_length` | **YES** | |
| | `min_length` | **YES** | |
| **Advanced** | `freshness` | **YES** | |
| | `schema` | **YES** | |
| | `reference` | **YES** | FK checks via failed rows |
| | `user_defined` | **YES** | Custom SQL |
| | `custom_sql` | **YES** | Alias for user_defined |
| | `scalar_comparison` | **YES** | |

### NOT Supported - Remove/Workaround Required

| Metric | Reason | Workaround | Action |
|--------|--------|------------|--------|
| `stddev` | MS SQL not supported by Soda | Use `custom_sql` with T-SQL `STDEV()` | **Already excluded** |
| `variance` | MS SQL not supported by Soda | Use `custom_sql` with T-SQL `VAR()` | **Already excluded** |
| `stddev_pop` | MS SQL not supported | Use `custom_sql` with `STDEVP()` | **Already excluded** |
| `var_pop` | MS SQL not supported | Use `custom_sql` with `VARP()` | **Already excluded** |
| `max_length` | Soda Core 3.5.6 bug | Use `custom_sql` with `MAX(LEN(col))` | **Already excluded** |
| `valid_percent` | Soda Core 3.5.6 bug | Use `invalid_percent` (inverse) | **Already excluded** |

**Good News:** Legacy system already excludes these in `yaml_generator.py` - no changes needed.

---

## Regex/Pattern Matching Limitations

### The Problem

T-SQL does NOT support regex. Soda uses `PATINDEX()` as workaround:

```sql
PATINDEX('%{pattern}%', column COLLATE SQL_Latin1_General_Cp1_CS_AS) > 0
```

### Impact on `valid format` Checks

| Pattern Type | Works? | Example |
|--------------|--------|---------|
| Simple wildcards | **YES** | `%test%` |
| Character ranges `[a-z]` | **YES** | Auto-expanded |
| Character ranges `[0-9]` | **NO** | Must manually expand |
| Anchors `^` `$` | **NO** | `^abc` becomes `%abc%` |
| Email validation | **NO** | Pattern too complex |
| Phone validation | **NO** | Pattern too complex |

### Workaround for Complex Patterns

Use `custom_sql` instead of `valid format`:

```sql
-- Email validation workaround
SELECT COUNT(*)
FROM dbo.Customers
WHERE Email NOT LIKE '%_@__%.__%'
```

### Recommendation

1. **Avoid** `valid format` with complex regex in Fabric
2. **Use** `custom_sql` for email/phone/complex validation
3. **Document** this limitation for users

---

## Connection Configuration

### Fabric Python Notebook Setup

```python
# Cell 1: Imports
from soda.scan import Scan
from azure.identity import ClientSecretCredential
import os

# Cell 2: Configuration
FABRIC_CONFIG = """
data_source fabric_dwh:
  type: fabric
  connection:
    driver: ODBC Driver 18 for SQL Server
    host: {host}.datawarehouse.fabric.microsoft.com
    port: 1433
    database: {database}
    authentication: activedirectoryserviceprincipal
    client_id: {client_id}
    client_secret: {client_secret}
    tenant_id: {tenant_id}
  encrypt: true
  trust_server_certificate: false
"""

# Cell 3: Execute Scan
scan = Scan()
scan.set_data_source_name("fabric_dwh")
scan.add_configuration_yaml_str(config)
scan.add_sodacl_yaml_str(checks_yaml)
scan.execute()

results = scan.get_scan_results()
```

### Authentication Options

| Method | Use Case | Config Key |
|--------|----------|------------|
| Service Principal | Automated pipelines | `activedirectoryserviceprincipal` |
| Interactive | Development/testing | `activedirectoryinteractive` |
| Password | Not recommended | `activedirectorypassword` |

---

## Migration Path: Legacy to Fabric Notebook

### What Changes

| Component | Legacy (Flask/Synapse) | Fabric Notebook |
|-----------|----------------------|-----------------|
| Package | `soda-core-sqlserver` | `soda-core-fabric` |
| Connection type | `sqlserver` | `fabric` |
| Host | `*.database.windows.net` | `*.datawarehouse.fabric.microsoft.com` |
| Compute | Synapse Spark | Python 2-core VM |

### What Stays the Same

| Component | Notes |
|-----------|-------|
| `yaml_generator.py` | No changes needed |
| `scan_orchestrator.py` | No changes needed |
| All 20 supported metrics | Already compatible |
| Database schema | No changes needed |
| Stored procedures | No changes needed |

---

## Required Code Changes

### 1. Update Connection Config in Database

Update `dq_sources.connection_yaml` for Fabric DWH sources:

```yaml
# OLD (sqlserver)
data_source my_source:
  type: sqlserver
  host: server.database.windows.net
  ...

# NEW (fabric)
data_source my_source:
  type: fabric
  connection:
    driver: ODBC Driver 18 for SQL Server
    host: server.datawarehouse.fabric.microsoft.com
    ...
```

### 2. Create Fabric Notebook Template

See [FABRIC-NOTEBOOK-TEMPLATE.md](FABRIC-NOTEBOOK-TEMPLATE.md) for ready-to-use notebook.

### 3. No Core Code Changes

`soda_quality/core/` modules work unchanged - Soda Core handles the Fabric-specific connection internally.

---

## Known Limitations Summary

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No regex support | Cannot use complex patterns | Use `custom_sql` |
| Case-sensitive matching | `[a-z]` won't match `A-Z` | Be explicit in patterns |
| PATINDEX substring match | `^abc` matches anywhere | Use `custom_sql` |
| No stddev/variance | Statistical checks unavailable | Use T-SQL in `custom_sql` |

---

## Testing Checklist

Before production deployment:

- [ ] Verify ODBC Driver 18 available in notebook
- [ ] Test `soda-core-fabric` installation
- [ ] Test Service Principal authentication
- [ ] Run each of 20 supported metrics
- [ ] Verify results write back to database
- [ ] Test freshness checks with Fabric tables
- [ ] Test schema checks
- [ ] Test custom_sql checks
- [ ] Document any new limitations found

---

## References

- [Soda Fabric Documentation](https://docs.soda.io/soda-v4/reference/data-source-reference-for-soda-core/microsoft-fabric)
- [Fabric Python vs PySpark Notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/fabric-notebook-selection-guide)
- [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
- [Soda Core Release Notes](https://docs.soda.io/release-notes/soda-core.html)
