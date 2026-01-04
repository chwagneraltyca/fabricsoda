# DB Test - Test Write Back to Metadata DB
# ============================================================================
# Uses pyodbc + Service Principal (bypasses Fabric API)
# SP has db_datareader, db_datawriter, and EXECUTE permissions

# %% [markdown]
# # DB Test - Execution Schema Write Back Test
#
# Uses pyodbc with Service Principal authentication.
# This bypasses Fabric API entirely - connects directly to database.

# %%
%pip install pyodbc --quiet
print("pyodbc installed!")

# %%
import pyodbc
import uuid
import notebookutils

# Configuration
META_DB_SERVER = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.database.fabric.microsoft.com"
META_DB_NAME = "soda_db-3dbb8254-b235-48a7-b66b-6b321f471b52"

# Key Vault for Service Principal secret
KEY_VAULT_URI = "https://chwakv.vault.azure.net/"
SECRET_NAME = "dq-checker-spn-secret"
CLIENT_ID = "b9450ac1-a673-4e67-87de-1b3b94036a40"

print("=" * 60)
print("DB TEST - pyodbc + Service Principal")
print("=" * 60)
print(f"Server: {META_DB_SERVER}")
print(f"Database: {META_DB_NAME}")

# %%
# Get secret from Key Vault
print("\n[1] Loading secret from Key Vault...")
CLIENT_SECRET = notebookutils.credentials.getSecret(KEY_VAULT_URI, SECRET_NAME)
print("Secret loaded!")

# %%
# Connect via pyodbc + Service Principal
print("\n[2] Connecting via pyodbc...")
conn_str = (
    f"Driver={{ODBC Driver 18 for SQL Server}};"
    f"Server={META_DB_SERVER},1433;"
    f"Database={META_DB_NAME};"
    f"Authentication=ActiveDirectoryServicePrincipal;"
    f"UID={CLIENT_ID};"
    f"PWD={CLIENT_SECRET};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=no;"
)
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()
print("Connected!")

# %%
# Check tables exist
print("\n[3] Checking execution tables...")
cursor.execute("""
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME IN ('dq_execution_logs', 'dq_results')
""")
tables = [row[0] for row in cursor.fetchall()]
print(f"Found: {tables}")

# %%
# Test write back
print("\n[4] Testing write back...")
run_id = f"test_{str(uuid.uuid4())[:8]}"
print(f"Run ID: {run_id}")

# Create execution log via SP
cursor.execute(f"EXEC sp_create_execution_log @run_id='{run_id}', @suite_id=1")
execution_log_id = int(cursor.fetchone()[0])
conn.commit()
print(f"Execution Log ID: {execution_log_id}")

# Insert test results via SP (check_id=NULL for test data)
test_results = [
    ("row_count > 0 [test]", "pass", 1000),
    ("missing_count = 0 [test]", "pass", 0),
    ("duplicate_count = 0 [test]", "fail", 5),
]

for name, outcome, value in test_results:
    cursor.execute(f"""
        EXEC sp_insert_result
            @run_id='{run_id}',
            @execution_log_id={execution_log_id},
            @check_id=NULL,
            @check_name='{name}',
            @check_outcome='{outcome}',
            @check_value={value}
    """)
    cursor.fetchone()
    print(f"  Inserted: {name} -> {outcome}")
conn.commit()

# Update execution log via SP
cursor.execute(f"""
    EXEC sp_update_execution_log
        @execution_log_id={execution_log_id},
        @status='completed',
        @total_checks=3,
        @checks_passed=2,
        @checks_failed=1,
        @checks_warned=0,
        @has_failures=1
""")
conn.commit()
print("Execution log updated!")

# %%
# Verify
print("\n[5] Verifying results...")
cursor.execute(f"SELECT * FROM dq_execution_logs WHERE run_id='{run_id}'")
cols = [c[0] for c in cursor.description]
row = cursor.fetchone()
log = dict(zip(cols, row))
print(f"  Status: {log['execution_status']}")
print(f"  Total: {log['total_checks']}, Passed: {log['checks_passed']}, Failed: {log['checks_failed']}")

cursor.execute(f"SELECT check_name, check_outcome, check_value FROM dq_results WHERE run_id='{run_id}'")
print("  Results:")
for row in cursor.fetchall():
    print(f"    {row[0]}: {row[1]} ({row[2]})")

# %%
print("\n" + "=" * 60)
print("SUCCESS! Write back to metadata DB working!")
print("=" * 60)
conn.close()
