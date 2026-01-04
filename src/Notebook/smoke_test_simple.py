# Simple Smoke Test - Debug Version
# ============================================================================
# Minimal notebook to test Soda connection to Fabric DWH

# %% [markdown]
# # Simple Smoke Test
# Debug version with minimal code to identify issues.

# %%
# Step 1: Show Python version
import sys
print(f"Python version: {sys.version}")

# %%
# Step 2: Install Soda packages
%pip install soda-core-sqlserver soda-core-fabric pyodbc --quiet
print("Packages installed!")

# %%
# Step 3: Import and test
from soda.scan import Scan
print("Soda imported successfully!")

# %%
# Step 4: Configuration (using Key Vault for secrets)
import notebookutils

# Key Vault configuration
KEY_VAULT_URI = "https://chwakv.vault.azure.net/"
SECRET_NAME = "dq-checker-spn-secret"

# Target DWH
DWH_SERVER = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.datawarehouse.fabric.microsoft.com"
DWH_DATABASE = "sample_dwh"

# Service Principal (ID is not a secret, secret comes from Key Vault)
CLIENT_ID = "b9450ac1-a673-4e67-87de-1b3b94036a40"

print(f"Target: {DWH_SERVER}")
print(f"Database: {DWH_DATABASE}")
print(f"Key Vault: {KEY_VAULT_URI}")
print(f"Secret Name: {SECRET_NAME}")

# Get secret from Key Vault
print("\nRetrieving secret from Key Vault...")
CLIENT_SECRET = notebookutils.credentials.getSecret(KEY_VAULT_URI, SECRET_NAME)
print("Secret retrieved successfully!")

# %%
# Step 5: Test sqlserver + Service Principal
config = f"""
data_source fabric_dwh:
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

check_yaml = """
checks for INFORMATION_SCHEMA.TABLES:
  - row_count > 0:
      name: "Smoke test - tables exist"
"""

print("Config:")
print(config)
print("\nCheck YAML:")
print(check_yaml)

# %%
# Step 6: Execute scan
try:
    scan = Scan()
    scan.set_data_source_name("fabric_dwh")
    scan.set_scan_definition_name("smoke_test")
    scan.add_configuration_yaml_str(config)
    scan.add_sodacl_yaml_str(check_yaml)

    print("Executing scan...")
    scan.execute()

    print("\n=== SCAN LOGS ===")
    print(scan.get_logs_text())

    if scan.has_error_logs():
        print("\n=== ERRORS ===")
        print(scan.get_error_logs_text())
        print("\nRESULT: FAILED")
    else:
        results = scan.get_scan_results()
        print("\n=== RESULTS ===")
        print(f"Checks: {len(results.get('checks', []))}")
        print("\nRESULT: SUCCESS!")
except Exception as e:
    print(f"\n=== EXCEPTION ===")
    print(f"Type: {type(e).__name__}")
    print(f"Message: {str(e)}")
    import traceback
    traceback.print_exc()
