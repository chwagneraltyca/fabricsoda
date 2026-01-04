# Smoke Test - Soda Authentication Methods for Fabric DWH
# ============================================================================
# Based on working old notebook that used soda-core-sqlserver with type: sqlserver
# Tests both soda-core-fabric and soda-core-sqlserver approaches
# ============================================================================

# %% [markdown]
# # Soda Authentication Smoke Test
#
# Testing different Soda packages and authentication methods:
# - `soda-core-sqlserver` with `type: sqlserver` (old working approach)
# - `soda-core-fabric` with `type: fabric` (new approach)

# %%
# Install BOTH packages
%pip install soda-core-sqlserver soda-core-fabric pyodbc --quiet

# %%
# Configuration
DWH_SERVER = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.datawarehouse.fabric.microsoft.com"
DWH_DATABASE = "sample_dwh"

# Service Principal credentials
CLIENT_ID = "b9450ac1-a673-4e67-87de-1b3b94036a40"
CLIENT_SECRET = "<YOUR_CLIENT_SECRET>"  # Replace with actual secret or use Key Vault

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
# Using soda-core-sqlserver with type: sqlserver and AD Service Principal auth

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
# Using soda-core-fabric with type: fabric and AD Service Principal auth

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
# Using soda-core-fabric with fabricspark authentication (designed for Fabric notebooks)

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
# Using soda-core-sqlserver with trusted connection (Windows/managed identity)

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
