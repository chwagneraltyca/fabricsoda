# Soda Authentication Smoke Test Template for Fabric Python Notebooks
# ============================================================================
# Use this template to test which Soda authentication methods work in your
# Fabric Python notebook environment.
#
# Tested authentication methods:
# - soda-core-sqlserver with type: sqlserver + ActiveDirectoryServicePrincipal
# - soda-core-fabric with type: fabric + activedirectoryserviceprincipal
# - soda-core-fabric with type: fabric + fabricspark
# - soda-core-sqlserver with type: sqlserver + trusted_connection
#
# Reference: https://docs.soda.io/data-source-reference/connect-fabric
# ============================================================================

# %% [markdown]
# # Soda Authentication Smoke Test
#
# Tests different Soda packages and authentication methods for Fabric DWH.

# %%
# Install packages
%pip install soda-core-sqlserver soda-core-fabric pyodbc --quiet

# %%
# =============================================================================
# CONFIGURATION - Update these values for your environment
# =============================================================================

# Target Data Warehouse
DWH_SERVER = "<your-server>.datawarehouse.fabric.microsoft.com"
DWH_DATABASE = "<your-database>"

# Service Principal credentials (for SPN-based auth)
# In production, use Key Vault: notebookutils.credentials.getSecret()
CLIENT_ID = "<your-client-id>"
CLIENT_SECRET = "<your-client-secret>"

print(f"Target: {DWH_SERVER}")
print(f"Database: {DWH_DATABASE}")

# %%
from soda.scan import Scan

# Simple check - just verify connection works
SIMPLE_CHECK = """
checks for INFORMATION_SCHEMA.TABLES:
  - row_count > 0:
      name: "Smoke test - tables exist"
"""

def test_auth_method(name: str, config: str):
    """Test a single authentication method."""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")

    try:
        scan = Scan()
        scan.set_data_source_name("test_dwh")
        scan.set_scan_definition_name(f"smoke_{name}")
        scan.add_configuration_yaml_str(config)
        scan.add_sodacl_yaml_str(SIMPLE_CHECK)

        print("  Executing scan...")
        scan.execute()

        logs = scan.get_logs_text()
        print("  Logs (first 800 chars):")
        print(logs[:800])

        if scan.has_error_logs():
            print(f"\n  RESULT: FAILED")
            return False
        else:
            results = scan.get_scan_results()
            checks = results.get('checks', [])
            print(f"\n  RESULT: SUCCESS! Checks executed: {len(checks)}")
            return True
    except Exception as e:
        print(f"  EXCEPTION: {str(e)[:500]}")
        return False

# %% [markdown]
# ## Test 1: sqlserver + Service Principal
#
# Using `soda-core-sqlserver` with `type: sqlserver` and AD Service Principal auth.
# This is based on the old working approach from Synapse notebooks.

# %%
config_sqlserver_spn = f"""
data_source test_dwh:
  type: sqlserver
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  port: '1433'
  database: {DWH_DATABASE}
  authentication: ActiveDirectoryServicePrincipal
  username: {CLIENT_ID}
  password: {CLIENT_SECRET}
  encrypt: true
  trust_server_certificate: false
"""
result_sqlserver_spn = test_auth_method("sqlserver_ServicePrincipal", config_sqlserver_spn)

# %% [markdown]
# ## Test 2: fabric + Service Principal
#
# Using `soda-core-fabric` with `type: fabric` and AD Service Principal auth.

# %%
config_fabric_spn = f"""
data_source test_dwh:
  type: fabric
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  database: {DWH_DATABASE}
  authentication: activedirectoryserviceprincipal
  client_id: {CLIENT_ID}
  client_secret: {CLIENT_SECRET}
  encrypt: true
"""
result_fabric_spn = test_auth_method("fabric_ServicePrincipal", config_fabric_spn)

# %% [markdown]
# ## Test 3: fabric + fabricspark
#
# Using `soda-core-fabric` with `fabricspark` authentication.
# Designed for Fabric notebooks - uses managed identity.

# %%
config_fabric_spark = f"""
data_source test_dwh:
  type: fabric
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  database: {DWH_DATABASE}
  authentication: fabricspark
  encrypt: true
"""
result_fabric_spark = test_auth_method("fabric_fabricspark", config_fabric_spark)

# %% [markdown]
# ## Test 4: sqlserver + trusted_connection
#
# Using `soda-core-sqlserver` with trusted connection (managed identity).

# %%
config_sqlserver_trusted = f"""
data_source test_dwh:
  type: sqlserver
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  port: '1433'
  database: {DWH_DATABASE}
  trusted_connection: true
  encrypt: true
"""
result_sqlserver_trusted = test_auth_method("sqlserver_trusted", config_sqlserver_trusted)

# %% [markdown]
# ## Summary

# %%
print("\n" + "="*60)
print("AUTHENTICATION TEST SUMMARY")
print("="*60)
print(f"  sqlserver + SPN:       {'PASS' if result_sqlserver_spn else 'FAIL'}")
print(f"  fabric + SPN:          {'PASS' if result_fabric_spn else 'FAIL'}")
print(f"  fabric + fabricspark:  {'PASS' if result_fabric_spark else 'FAIL'}")
print(f"  sqlserver + trusted:   {'PASS' if result_sqlserver_trusted else 'FAIL'}")
print("="*60)

# Recommend
working = []
if result_sqlserver_spn: working.append("type: sqlserver + ActiveDirectoryServicePrincipal")
if result_fabric_spn: working.append("type: fabric + activedirectoryserviceprincipal")
if result_fabric_spark: working.append("type: fabric + fabricspark")
if result_sqlserver_trusted: working.append("type: sqlserver + trusted_connection")

if working:
    print(f"\nWORKING METHODS:")
    for w in working:
        print(f"  - {w}")
    print(f"\nRECOMMENDED: {working[0]}")
else:
    print("\nNo authentication method worked!")
