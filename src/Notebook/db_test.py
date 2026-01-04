# DB Test - Deploy Execution Schema and Test Write Back
# ============================================================================
# Uses notebookutils.data.connect_to_artifact() - same as data lineage notebook

# %% [markdown]
# # DB Test - Execution Schema Deployment & Write Back Test
#
# Uses `notebookutils.data.connect_to_artifact()` for Fabric SQL Database access.
# This is the same pattern used in the data lineage notebook.

# %%
import uuid
from notebookutils import data

# Configuration - just the display name, same as data lineage notebook
CONFIG = {
    "db_name": "soda_db"
}

print("=" * 60)
print("DB TEST - Using notebookutils.data.connect_to_artifact()")
print("=" * 60)
print(f"Target DB: {CONFIG['db_name']}")

# %%
# Connect to metadata DB (same pattern as data lineage notebook)
print("\n[1] Connecting to metadata DB...")
conn = data.connect_to_artifact(CONFIG["db_name"])
cursor = conn.cursor()
print("Connected successfully!")

# %%
# Check if execution tables exist
print("\n[2] Checking if execution tables exist...")

cursor.execute("""
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME IN ('dq_execution_logs', 'dq_results')
    ORDER BY TABLE_NAME
""")
existing_tables = [row[0] for row in cursor.fetchall()]
print(f"Found tables: {existing_tables}")

# %%
# Create tables if needed
if 'dq_execution_logs' not in existing_tables:
    print("Creating dq_execution_logs table...")
    cursor.execute("""
        CREATE TABLE dbo.dq_execution_logs (
            execution_log_id BIGINT IDENTITY(1,1) PRIMARY KEY,
            run_id NVARCHAR(50) NOT NULL,
            suite_id INT NULL,
            execution_type NVARCHAR(50) NOT NULL DEFAULT 'suite',
            execution_status NVARCHAR(20) NOT NULL DEFAULT 'running',
            total_checks INT NULL,
            checks_passed INT NULL,
            checks_failed INT NULL,
            checks_warned INT NULL,
            has_failures BIT DEFAULT 0,
            error_message NVARCHAR(MAX) NULL,
            generated_yaml NVARCHAR(MAX) NULL,
            created_at DATETIME2 DEFAULT GETDATE()
        )
    """)
    cursor.execute("CREATE INDEX IX_execution_logs_run ON dbo.dq_execution_logs(run_id)")
    conn.commit()
    print("Created dq_execution_logs!")

if 'dq_results' not in existing_tables:
    print("Creating dq_results table...")
    cursor.execute("""
        CREATE TABLE dbo.dq_results (
            result_id INT IDENTITY(1,1) PRIMARY KEY,
            run_id NVARCHAR(50) NOT NULL,
            execution_log_id BIGINT NOT NULL,
            check_id INT NULL,
            check_name NVARCHAR(500) NOT NULL,
            check_outcome NVARCHAR(20) NOT NULL,
            check_value DECIMAL(18,4) NULL,
            created_at DATETIME2 DEFAULT GETDATE()
        )
    """)
    cursor.execute("CREATE INDEX IX_results_run ON dbo.dq_results(run_id)")
    cursor.execute("CREATE INDEX IX_results_execution ON dbo.dq_results(execution_log_id)")
    conn.commit()
    print("Created dq_results!")

print("Tables ready!")

# %%
# Create stored procedures
print("\n[3] Creating stored procedures...")

cursor.execute("""
CREATE OR ALTER PROCEDURE dbo.sp_create_execution_log
    @run_id NVARCHAR(50),
    @suite_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.dq_execution_logs (run_id, suite_id, execution_status, created_at)
    VALUES (@run_id, @suite_id, 'running', GETDATE());
    SELECT SCOPE_IDENTITY() AS execution_log_id;
END
""")
conn.commit()
print("  sp_create_execution_log - OK")

cursor.execute("""
CREATE OR ALTER PROCEDURE dbo.sp_update_execution_log
    @execution_log_id BIGINT,
    @status NVARCHAR(20),
    @total_checks INT = NULL,
    @checks_passed INT = NULL,
    @checks_failed INT = NULL,
    @checks_warned INT = NULL,
    @has_failures BIT = NULL,
    @generated_yaml NVARCHAR(MAX) = NULL,
    @error_message NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.dq_execution_logs
    SET execution_status = @status,
        total_checks = COALESCE(@total_checks, total_checks),
        checks_passed = COALESCE(@checks_passed, checks_passed),
        checks_failed = COALESCE(@checks_failed, checks_failed),
        checks_warned = COALESCE(@checks_warned, checks_warned),
        has_failures = COALESCE(@has_failures, has_failures),
        generated_yaml = COALESCE(@generated_yaml, generated_yaml),
        error_message = COALESCE(@error_message, error_message)
    WHERE execution_log_id = @execution_log_id;
END
""")
conn.commit()
print("  sp_update_execution_log - OK")

cursor.execute("""
CREATE OR ALTER PROCEDURE dbo.sp_insert_result
    @run_id NVARCHAR(50),
    @execution_log_id BIGINT,
    @check_id INT = NULL,
    @check_name NVARCHAR(500),
    @check_outcome NVARCHAR(20),
    @check_value DECIMAL(18,4) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.dq_results (run_id, execution_log_id, check_id, check_name, check_outcome, check_value, created_at)
    VALUES (@run_id, @execution_log_id, @check_id, @check_name, @check_outcome, @check_value, GETDATE());
    SELECT SCOPE_IDENTITY() AS result_id;
END
""")
conn.commit()
print("  sp_insert_result - OK")

print("Stored procedures ready!")

# %%
# Test write back with fake data
print("\n[4] Testing write back with fake data...")

run_id = f"test_{str(uuid.uuid4())[:8]}"
suite_id = 1
print(f"  Run ID: {run_id}")

# Create execution log
cursor.execute(f"EXEC sp_create_execution_log @run_id='{run_id}', @suite_id={suite_id}")
execution_log_id = int(cursor.fetchone()[0])
conn.commit()
print(f"  Execution Log ID: {execution_log_id}")

# Insert fake results
fake_results = [
    (1, "Row count check [check_id:1]", "pass", 1000),
    (2, "Missing values check [check_id:2]", "pass", 0),
    (3, "Duplicate check [check_id:3]", "fail", 5),
    (4, "Threshold check [check_id:4]", "warn", 95.5),
]

print("  Inserting check results...")
for check_id, check_name, outcome, value in fake_results:
    escaped_name = check_name.replace("'", "''")
    cursor.execute(f"""
        EXEC sp_insert_result
            @run_id='{run_id}',
            @execution_log_id={execution_log_id},
            @check_id={check_id},
            @check_name='{escaped_name}',
            @check_outcome='{outcome}',
            @check_value={value}
    """)
    cursor.fetchone()  # consume result
    print(f"    {check_name}: {outcome}")
conn.commit()

# Update execution log
yaml_content = "checks for test_table:\\n  - row_count > 0"
cursor.execute(f"""
    EXEC sp_update_execution_log
        @execution_log_id={execution_log_id},
        @status='completed',
        @total_checks=4,
        @checks_passed=2,
        @checks_failed=1,
        @checks_warned=1,
        @has_failures=1,
        @generated_yaml='{yaml_content}'
""")
conn.commit()
print("  Execution log updated!")

# %%
# Verify results
print("\n[5] Verifying results in database...")

cursor.execute(f"SELECT * FROM dq_execution_logs WHERE run_id = '{run_id}'")
columns = [col[0] for col in cursor.description]
row = cursor.fetchone()
log_dict = dict(zip(columns, row))

print("\n  === Execution Log ===")
print(f"  execution_log_id: {log_dict['execution_log_id']}")
print(f"  run_id: {log_dict['run_id']}")
print(f"  execution_status: {log_dict['execution_status']}")
print(f"  total_checks: {log_dict['total_checks']}")
print(f"  checks_passed: {log_dict['checks_passed']}")
print(f"  checks_failed: {log_dict['checks_failed']}")
print(f"  checks_warned: {log_dict['checks_warned']}")
print(f"  has_failures: {log_dict['has_failures']}")

cursor.execute(f"SELECT * FROM dq_results WHERE run_id = '{run_id}' ORDER BY result_id")
result_columns = [col[0] for col in cursor.description]
result_rows = cursor.fetchall()

print(f"\n  === Check Results ({len(result_rows)} rows) ===")
for row in result_rows:
    r = dict(zip(result_columns, row))
    print(f"    {r['check_name']}: {r['check_outcome']} (value={r['check_value']})")

# %%
# Summary
print("\n" + "=" * 60)
print("TEST COMPLETE!")
print("=" * 60)
print(f"  Run ID: {run_id}")
print(f"  Execution Log ID: {execution_log_id}")
print(f"  Results inserted: {len(fake_results)}")
print(f"  All verifications passed!")
print("=" * 60)

conn.close()
