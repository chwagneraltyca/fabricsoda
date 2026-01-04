# Fabric Python Notebook - DQ Checker Scan Executor
# ============================================================================
# Execute data quality checks against Fabric Data Warehouse using Soda Core.
#
# Architecture: READ (SQL DB) -> YAML -> EXECUTE (Soda) -> PARSE -> WRITE (SQL DB + OneLake)
#
# Requirements:
#   - Fabric Python Notebook (NOT PySpark)
#   - soda-core-sqlserver OR soda-core-fabric package
#   - pyodbc with ODBC Driver 18
#
# Authentication Methods (tested via smoke test):
#   - type: sqlserver + ActiveDirectoryServicePrincipal (RECOMMENDED)
#   - type: fabric + activedirectoryserviceprincipal
#   - type: fabric + fabricspark (managed identity)
#   - type: sqlserver + trusted_connection
# ============================================================================

# %% [markdown]
# # DQ Checker - Soda Core Scan Executor
#
# **Purpose:** Execute data quality checks against Fabric Data Warehouse using Soda Core.
#
# **Architecture:**
# ```
# READ (SQL DB) -> YAML -> EXECUTE (Soda) -> PARSE -> WRITE (SQL DB + OneLake)
# ```
#
# | Step | Function | Source |
# |------|----------|--------|
# | READ | Fetch check metadata | SQL DB via pyodbc |
# | YAML | Generate SodaCL | Proven logic from Legacy |
# | EXECUTE | Run Soda scan | soda-core-fabric |
# | PARSE | Extract results | Proven logic from Legacy |
# | WRITE | Store results | SQL DB + OneLake |

# %% [markdown]
# ## 1. Install Dependencies
#
# Run once per session to install required packages.

# %%
# Install Soda packages (run once per session)
# - soda-core-sqlserver: Best for Service Principal auth
# - soda-core-fabric: For fabricspark auth (managed identity)
%pip install soda-core-sqlserver soda-core-fabric pyodbc --quiet

# %% [markdown]
# ## 2. Configuration
#
# Set execution parameters and connection details.

# %%
# ============================================================================
# CONFIGURATION - Edit these values or pass via pipeline parameters
# ============================================================================

# =============================================================================
# EXECUTION MODE
# =============================================================================
# Set SMOKE_TEST = True to test Soda connection without metadata DB
# Set SMOKE_TEST = False for full suite execution
SMOKE_TEST = True

# Execution parameter (passed from Fabric Pipeline or set manually)
SUITE_ID = 1

# =============================================================================
# METADATA DATABASE (Fabric SQL Database)
# =============================================================================
META_DB_SERVER = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.database.fabric.microsoft.com"
META_DB_NAME = "soda_db-3dbb8254-b235-48a7-b66b-6b321f471b52"

# =============================================================================
# TARGET DATA WAREHOUSE (Fabric DWH - where data lives)
# =============================================================================
DWH_SERVER = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.datawarehouse.fabric.microsoft.com"
DWH_DATABASE = "sample_dwh"

# =============================================================================
# KEY VAULT CONFIGURATION
# Secrets are stored securely in Azure Key Vault
# =============================================================================
KEY_VAULT_URI = "https://chwakv.vault.azure.net/"
SECRET_NAME = "dq-checker-spn-secret"

# =============================================================================
# SERVICE PRINCIPAL CREDENTIALS
# Client ID is not a secret, Client Secret comes from Key Vault
# =============================================================================
CLIENT_ID = "b9450ac1-a673-4e67-87de-1b3b94036a40"
CLIENT_SECRET = None  # Will be loaded from Key Vault at runtime

# =============================================================================
# ONELAKE PATHS
# =============================================================================
LAKEHOUSE_PATH = "/lakehouse/default/Files"
LOGS_FOLDER = "dq_logs"

# %% [markdown]
# ## 3. Imports & Setup

# %%
# Standard library
import json
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

# Data handling
import pandas as pd

# Database
import pyodbc

# Soda Core
from soda.scan import Scan

# Fabric utilities (always available in Fabric Python notebooks)
import notebookutils

# Generate unique run ID
RUN_ID = str(uuid.uuid4())[:8]
print(f"Run ID: {RUN_ID}")
print(f"Suite ID: {SUITE_ID}")

# Load secret from Key Vault
print(f"\nLoading secret from Key Vault: {KEY_VAULT_URI}")
CLIENT_SECRET = notebookutils.credentials.getSecret(KEY_VAULT_URI, SECRET_NAME)
print("Secret loaded successfully!")

# %% [markdown]
# ## 4. Database Connection
#
# Connect to metadata SQL DB using notebookutils.data.connect_to_artifact() for automatic auth.

# %%
def get_metadata_connection():
    """
    Connect to metadata SQL DB using Fabric notebookutils.

    Uses notebookutils.data.connect_to_artifact() which handles authentication automatically.
    No tokens required - Fabric handles identity seamlessly.
    """
    # Use Fabric's built-in artifact connection (no tokens needed!)
    return notebookutils.data.connect_to_artifact(
        META_DB_NAME,  # Can use name or ID
        artifact_type="sqldatabase"
    )


def get_dwh_config_yaml(auth_method: str = "sqlserver_spn") -> str:
    """
    Generate Soda connection YAML for Fabric DWH.

    Args:
        auth_method: Authentication method to use
            - "sqlserver_spn": soda-core-sqlserver with Service Principal (RECOMMENDED)
            - "fabric_spn": soda-core-fabric with Service Principal
            - "fabric_spark": soda-core-fabric with managed identity (fabricspark)
            - "sqlserver_trusted": soda-core-sqlserver with trusted_connection

    Returns:
        Soda configuration YAML string
    """
    if auth_method == "sqlserver_spn":
        # RECOMMENDED: soda-core-sqlserver with Service Principal
        # This is the most reliable method based on smoke testing
        return f"""
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

    elif auth_method == "fabric_spn":
        # soda-core-fabric with Service Principal
        return f"""
data_source fabric_dwh:
  type: fabric
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  database: {DWH_DATABASE}
  authentication: activedirectoryserviceprincipal
  client_id: {CLIENT_ID}
  client_secret: {CLIENT_SECRET}
  encrypt: true
"""

    elif auth_method == "fabric_spark":
        # soda-core-fabric with managed identity (fabricspark)
        return f"""
data_source fabric_dwh:
  type: fabric
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  database: {DWH_DATABASE}
  authentication: fabricspark
  encrypt: true
"""

    elif auth_method == "sqlserver_trusted":
        # soda-core-sqlserver with trusted connection
        return f"""
data_source fabric_dwh:
  type: sqlserver
  driver: ODBC Driver 18 for SQL Server
  host: {DWH_SERVER}
  port: '1433'
  database: {DWH_DATABASE}
  trusted_connection: true
  encrypt: true
"""

    else:
        raise ValueError(f"Unknown auth_method: {auth_method}")

# %% [markdown]
# ## 5. Component: READ
#
# Fetch check definitions from metadata database.

# %%
def read_suite_checks(conn, suite_id: int) -> pd.DataFrame:
    """
    Fetch enabled checks for suite execution.

    Args:
        conn: Fabric connection (from notebookutils.data.connect_to_artifact)
        suite_id: Suite to execute

    Returns:
        DataFrame with check definitions
    """
    query = f"""
        SELECT c.*, tc.schema_name
        FROM vw_checks_complete c
        JOIN suites_testcases st ON c.testcase_id = st.testcase_id
        WHERE st.suite_id = {suite_id} AND c.is_enabled = 1
        ORDER BY c.check_id
    """
    return conn.query(query)


def create_execution_log(conn, run_id: str, suite_id: int) -> int:
    """
    Create execution log entry with status='running'.

    Returns:
        execution_log_id
    """
    query = f"EXEC sp_create_execution_log @run_id='{run_id}', @suite_id={suite_id}"
    df = conn.query(query)
    return int(df.iloc[0, 0])

# %% [markdown]
# ## 6. Component: YAML Generator
#
# Generate SodaCL YAML from check definitions.
#
# **Status:** PROVEN - Copied from Legacy `yaml_generator.py`

# %%
# YAML Helper Functions (from yaml_helpers.py)

YAML_SPECIAL_CHARS = {':', '#', '{', '}', '[', ']', '&', '*', '!', '|', '>', '@', '`', '%'}


def yaml_safe_value(value: Optional[str]) -> str:
    """Make a string value safe for YAML output."""
    if value is None:
        return ''
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    if not value:
        return ''

    # Multi-line requires block scalar
    if '\n' in value:
        indented = '\n        '.join(value.split('\n'))
        return f'|\n        {indented}'

    # Check if quoting is needed
    needs_quoting = (
        any(c in value for c in YAML_SPECIAL_CHARS) or
        value.startswith("'") or value.startswith('"') or
        value.startswith(' ') or value.endswith(' ')
    )

    if needs_quoting:
        escaped = value.replace('\\', '\\\\').replace('"', '\\"')
        return f'"{escaped}"'

    return value


def yaml_safe_filter(filter_condition: Optional[str]) -> str:
    """Make a filter condition safe for YAML output."""
    if filter_condition is None:
        return ''
    if not isinstance(filter_condition, str):
        filter_condition = str(filter_condition)
    filter_condition = filter_condition.strip()
    if not filter_condition:
        return ''
    return yaml_safe_value(filter_condition)

# %%
# YAML Generator (from yaml_generator.py)

SUPPORTED_METRICS = [
    # Core metrics (14)
    'row_count', 'missing_count', 'missing_percent',
    'duplicate_count', 'duplicate_percent',
    'min', 'max', 'avg', 'sum',
    'invalid_count', 'invalid_percent', 'valid_count',
    'avg_length', 'min_length',
    # Advanced metrics (6)
    'reference', 'user_defined', 'custom_sql',
    'scalar_comparison', 'freshness', 'schema'
]


def generate_yaml_from_checks(checks_df: pd.DataFrame, schema_in_connection: Optional[str] = None) -> str:
    """
    Generate SodaCL YAML from checks DataFrame.

    Args:
        checks_df: DataFrame with check definitions
        schema_in_connection: Schema injected into connection config

    Returns:
        SodaCL YAML string
    """
    if checks_df.empty:
        return "# No checks found\n"

    yaml_lines = []

    for (schema_name, table_name), table_checks in checks_df.groupby(['schema_name', 'table_name']):
        # Build table identifier
        table_str = str(table_name)
        has_special_chars = ' ' in table_str or '-' in table_str

        if has_special_chars:
            fully_qualified_table = f'"{table_str}"'
        elif schema_in_connection and pd.notna(schema_name) and str(schema_name) == schema_in_connection:
            fully_qualified_table = table_str
        elif pd.notna(schema_name) and '.' not in table_str:
            fully_qualified_table = f"{schema_name}.{table_str}"
        else:
            fully_qualified_table = table_str

        # Collect check YAML
        table_check_lines = []
        for _, check in table_checks.iterrows():
            check_yaml = _generate_check_yaml(check)
            table_check_lines.extend(check_yaml)

        if table_check_lines:
            yaml_lines.append(f"checks for {fully_qualified_table}:")
            yaml_lines.extend(table_check_lines)
            yaml_lines.append("")

    return "\n".join(yaml_lines)


def _generate_check_yaml(check: pd.Series) -> List[str]:
    """Generate YAML lines for a single check."""
    lines = []
    metric = check['metric']
    column = check.get('column_name_quoted') or check.get('column_name')

    # Metrics that require a column
    column_required_metrics = [
        'missing_count', 'missing_percent',
        'duplicate_count', 'duplicate_percent',
        'min', 'max', 'avg', 'sum',
        'invalid_count', 'invalid_percent', 'valid_count',
        'avg_length', 'min_length', 'reference'
    ]

    # Special handling for advanced metrics
    if metric == 'freshness':
        return _generate_freshness_yaml(check)
    if metric == 'schema':
        return _generate_schema_yaml(check)
    if metric == 'reference':
        return _generate_reference_yaml(check)
    if metric in ['user_defined', 'custom_sql']:
        return _generate_custom_sql_yaml(check)
    if metric == 'scalar_comparison':
        return _generate_scalar_comparison_yaml(check)

    # Standard metrics
    if pd.notna(column) and metric in column_required_metrics:
        lines.append(f"  - {metric}({column}):")
    else:
        lines.append(f"  - {metric}:")

    # Check name with ID for linking
    check_name = check['check_name']
    if pd.notna(check.get('check_id')):
        check_name = f"{check_name} [check_id:{check['check_id']}]"
    lines.append(f'      name: "{check_name}"')

    # Add thresholds
    lines.extend(_generate_threshold_yaml(check))

    return lines


def _generate_threshold_yaml(check: pd.Series) -> List[str]:
    """Generate warn/fail threshold YAML."""
    lines = []

    # Warn threshold
    if pd.notna(check.get('warn_threshold')) and pd.notna(check.get('warn_comparison')):
        warn_op = '=' if check['warn_comparison'] == '==' else check['warn_comparison']
        lines.append(f"      warn: when {warn_op} {check['warn_threshold']}")

    # Fail threshold
    if pd.notna(check.get('fail_threshold')) and pd.notna(check.get('fail_comparison')):
        fail_op = '=' if check['fail_comparison'] == '==' else check['fail_comparison']
        lines.append(f"      fail: when {fail_op} {check['fail_threshold']}")

    return lines


def _generate_freshness_yaml(check: pd.Series) -> List[str]:
    """Generate YAML for freshness check."""
    lines = []

    if (pd.notna(check.get('freshness_column')) and
        pd.notna(check.get('freshness_threshold_value')) and
        pd.notna(check.get('freshness_threshold_unit'))):

        column = check['freshness_column']
        threshold_val = check['freshness_threshold_value']
        threshold_unit = check['freshness_threshold_unit']

        # Remove unnecessary decimals
        if isinstance(threshold_val, float) and threshold_val == int(threshold_val):
            threshold_val = int(threshold_val)

        lines.append(f"  - freshness({column}) < {threshold_val}{threshold_unit}:")

        check_name = check['check_name']
        if pd.notna(check.get('check_id')):
            check_name = f"{check_name} [check_id:{check['check_id']}]"
        lines.append(f'      name: "{check_name}"')

    return lines


def _generate_schema_yaml(check: pd.Series) -> List[str]:
    """Generate YAML for schema check."""
    lines = []
    lines.append(f"  - schema:")

    check_name = check['check_name']
    if pd.notna(check.get('check_id')):
        check_name = f"{check_name} [check_id:{check['check_id']}]"
    lines.append(f'      name: "{check_name}"')

    # Required columns
    if pd.notna(check.get('schema_required_columns')):
        try:
            required = json.loads(check['schema_required_columns'])
            if required:
                lines.append("      fail:")
                lines.append("        when required column missing:")
                for col in required:
                    lines.append(f"          - {col}")
        except:
            pass

    # Forbidden columns
    if pd.notna(check.get('schema_forbidden_columns')):
        try:
            forbidden = json.loads(check['schema_forbidden_columns'])
            if forbidden:
                if "      fail:" not in lines:
                    lines.append("      fail:")
                lines.append("        when forbidden column present:")
                for col in forbidden:
                    lines.append(f"          - {col}")
        except:
            pass

    return lines


def _generate_reference_yaml(check: pd.Series) -> List[str]:
    """Generate YAML for reference (FK) check."""
    lines = []

    if pd.notna(check.get('reference_table')) and pd.notna(check.get('reference_column')):
        source_column = check.get('column_name_quoted') or check.get('column_name')
        ref_table = check['reference_table']
        ref_column = check.get('reference_column_quoted') or check['reference_column']
        source_table = check['table_name']
        schema_name = check.get('schema_name', 'dbo')

        source_fqn = f"{schema_name}.{source_table}"
        ref_fqn = f"dbo.{ref_table}"

        lines.append(f"  - failed rows:")
        check_name = check['check_name']
        if pd.notna(check.get('check_id')):
            check_name = f"{check_name} [check_id:{check['check_id']}]"
        lines.append(f'      name: "{check_name}"')
        lines.append(f"      fail query: |")
        lines.append(f"        SELECT * FROM {source_fqn}")
        lines.append(f"        WHERE {source_column} IS NOT NULL")
        lines.append(f"          AND {source_column} NOT IN (")
        lines.append(f"            SELECT {ref_column} FROM {ref_fqn}")
        lines.append(f"          )")

    return lines


def _generate_custom_sql_yaml(check: pd.Series) -> List[str]:
    """Generate YAML for custom SQL check."""
    lines = []

    if pd.notna(check.get('custom_sql_query')):
        custom_sql = str(check['custom_sql_query']).strip()

        # Create safe metric name
        safe_metric_name = re.sub(r'[^a-zA-Z0-9_]', '_', check['check_name'].lower())
        safe_metric_name = re.sub(r'_+', '_', safe_metric_name).strip('_')

        # Build metric comparison
        fail_comparison = check.get('fail_comparison')
        if pd.notna(fail_comparison) and pd.notna(check.get('fail_threshold')):
            comparison = '=' if fail_comparison == '==' else fail_comparison
            lines.append(f"  - {safe_metric_name} {comparison} {check['fail_threshold']}:")
        else:
            lines.append(f"  - {safe_metric_name} = 0:")

        check_name = check['check_name']
        if pd.notna(check.get('check_id')):
            check_name = f"{check_name} [check_id:{check['check_id']}]"
        lines.append(f'      name: "{check_name}"')

        lines.append(f"      {safe_metric_name} query: |")
        for sql_line in custom_sql.split('\n'):
            lines.append(f"        {sql_line}")

    return lines


def _generate_scalar_comparison_yaml(check: pd.Series) -> List[str]:
    """Generate YAML for scalar comparison check."""
    lines = []

    if pd.notna(check.get('scalar_query_a')) and pd.notna(check.get('scalar_query_b')):
        query_a = str(check['scalar_query_a']).strip()
        query_b = str(check['scalar_query_b']).strip()
        operator = check.get('scalar_operator', '==')

        check_name = check['check_name']
        if pd.notna(check.get('check_id')):
            check_name = f"{check_name} [check_id:{check['check_id']}]"

        lines.append(f"  - failed rows:")
        lines.append(f'      name: "{check_name}"')
        lines.append(f"      fail query: |")
        lines.append(f"        WITH comparison AS (")
        lines.append(f"          SELECT")
        lines.append(f"            ({query_a}) AS query_a,")
        lines.append(f"            ({query_b}) AS query_b")
        lines.append(f"        )")
        lines.append(f"        SELECT query_a, query_b, query_a - query_b AS difference")
        lines.append(f"        FROM comparison")

        # Inverted operator logic
        where_map = {
            '==': 'query_a != query_b',
            '!=': 'query_a = query_b',
            '>': 'query_a <= query_b',
            '>=': 'query_a < query_b',
            '<': 'query_a >= query_b',
            '<=': 'query_a > query_b'
        }
        lines.append(f"        WHERE {where_map.get(operator, 'query_a != query_b')}")

    return lines

# %% [markdown]
# ## 7. Component: EXECUTE
#
# Run Soda scan against Fabric DWH.

# %%
def execute_soda_scan(yaml_content: str, dwh_config: str, run_id: str) -> Dict[str, Any]:
    """
    Execute Soda scan and return results.

    Args:
        yaml_content: SodaCL YAML
        dwh_config: Soda connection YAML
        run_id: Unique run identifier

    Returns:
        Dictionary with results, logs, and error status
    """
    scan = Scan()
    scan.set_data_source_name("fabric_dwh")
    scan.set_scan_definition_name(f"dq_checker_scan_{run_id}")
    scan.add_configuration_yaml_str(dwh_config)
    scan.add_sodacl_yaml_str(yaml_content)

    scan.execute()

    return {
        "results": scan.get_scan_results(),
        "logs": scan.get_logs_text(),
        "has_errors": scan.has_error_logs(),
        "error_logs": scan.get_error_logs_text() if scan.has_error_logs() else None
    }

# %% [markdown]
# ## 8. Component: PARSE
#
# Extract check results from Soda scan output.
#
# **Status:** PROVEN - Copied from Legacy `scan_orchestrator.py`

# %%
def parse_scan_results(scan_results: Dict) -> List[Dict]:
    """
    Parse Soda scan results into result records.

    Args:
        scan_results: Raw Soda scan results

    Returns:
        List of result dictionaries
    """
    results = []

    for check in scan_results.get('checks', []):
        # Extract check_id from name (format: "Check Name [check_id:123]")
        check_name = check.get('name', '')
        check_id_match = re.search(r'\[check_id:(\d+)\]', check_name)
        check_id = int(check_id_match.group(1)) if check_id_match else None

        # Get diagnostics for values and thresholds
        diagnostics = check.get('diagnostics', {})
        check_value = diagnostics.get('value', check.get('value'))

        results.append({
            'check_id': check_id,
            'check_name': check_name,
            'outcome': check.get('outcome', 'unknown'),
            'value': check_value
        })

    return results


def count_outcomes(results: List[Dict]) -> Dict[str, int]:
    """Count pass/fail/warn outcomes."""
    return {
        'total': len(results),
        'passed': len([r for r in results if r['outcome'] == 'pass']),
        'failed': len([r for r in results if r['outcome'] == 'fail']),
        'warned': len([r for r in results if r['outcome'] == 'warn']),
        'errors': len([r for r in results if r['outcome'] == 'error'])
    }

# %% [markdown]
# ## 9. Component: WRITE
#
# Store results to SQL DB (via SPs) and OneLake.

# %%
def write_results_to_db(conn, execution_log_id: int, run_id: str, results: List[Dict]):
    """Write individual check results to SQL DB via SP."""
    for r in results:
        # Escape single quotes in strings
        check_name = str(r['check_name']).replace("'", "''") if r['check_name'] else ''
        outcome = str(r['outcome']).replace("'", "''") if r['outcome'] else ''
        check_id = r['check_id'] if r['check_id'] else 'NULL'
        check_value = r['value'] if r['value'] is not None else 'NULL'

        query = f"""EXEC sp_insert_result
            @run_id='{run_id}',
            @execution_log_id={execution_log_id},
            @check_id={check_id},
            @check_name='{check_name}',
            @check_outcome='{outcome}',
            @check_value={check_value}"""
        conn.query(query)


def update_execution_log(conn, execution_log_id: int, counts: Dict, yaml_content: str,
                         error_message: Optional[str] = None):
    """Update execution log with completion status via SP."""
    status = 'failed' if error_message else 'completed'
    has_failures = 1 if counts['failed'] > 0 else 0

    # Escape single quotes
    yaml_escaped = yaml_content.replace("'", "''") if yaml_content else ''
    error_escaped = error_message.replace("'", "''") if error_message else ''
    error_param = f"'{error_escaped}'" if error_message else 'NULL'

    query = f"""EXEC sp_update_execution_log
        @execution_log_id={execution_log_id},
        @status='{status}',
        @total_checks={counts['total']},
        @checks_passed={counts['passed']},
        @checks_failed={counts['failed']},
        @checks_warned={counts['warned']},
        @has_failures={has_failures},
        @generated_yaml='{yaml_escaped}',
        @error_message={error_param}"""
    conn.query(query)


def write_to_onelake(run_id: str, execution_log_id: int, suite_id: int,
                     scan_results: Dict, soda_logs: str, yaml_content: str,
                     counts: Dict) -> str:
    """Write full results JSON to OneLake."""
    full_results = {
        "run_id": run_id,
        "execution_log_id": execution_log_id,
        "suite_id": suite_id,
        "timestamp": datetime.utcnow().isoformat(),
        "summary": counts,
        "scan_results": scan_results,
        "soda_logs": soda_logs,
        "yaml_content": yaml_content
    }

    json_content = json.dumps(full_results, indent=2, default=str)
    file_name = f"execution_{run_id}.json"
    log_path = f"{LAKEHOUSE_PATH}/{LOGS_FOLDER}/{file_name}"

    # Write to OneLake using Fabric notebookutils
    notebookutils.fs.put(log_path, json_content, overwrite=True)

    return log_path

# %% [markdown]
# ## 10. Smoke Test Mode
#
# Test Soda connection with a fake YAML (no metadata DB required).
# Set `SMOKE_TEST = True` in configuration to run this instead of full suite.

# %%
def run_smoke_test() -> Dict[str, Any]:
    """
    Run smoke test to verify Soda connection to DWH.

    Tests multiple authentication methods and reports which ones work.
    Uses a simple check against INFORMATION_SCHEMA.TABLES (always exists).

    Returns:
        Dictionary with test results for each auth method
    """
    print("=" * 60)
    print("SMOKE TEST - Testing Soda Authentication Methods")
    print("=" * 60)
    print(f"Target DWH: {DWH_SERVER}")
    print(f"Database: {DWH_DATABASE}")

    # Simple check that should always pass
    SMOKE_CHECK_YAML = """
checks for INFORMATION_SCHEMA.TABLES:
  - row_count > 0:
      name: "Smoke test - tables exist"
"""

    # Auth methods to test
    auth_methods = [
        ("sqlserver_spn", "soda-core-sqlserver + Service Principal (RECOMMENDED)"),
        ("fabric_spn", "soda-core-fabric + Service Principal"),
        ("fabric_spark", "soda-core-fabric + fabricspark (managed identity)"),
        ("sqlserver_trusted", "soda-core-sqlserver + trusted_connection"),
    ]

    results = {}

    for method_key, method_name in auth_methods:
        print(f"\n{'='*60}")
        print(f"Testing: {method_name}")
        print(f"{'='*60}")

        try:
            config = get_dwh_config_yaml(method_key)

            scan = Scan()
            scan.set_data_source_name("fabric_dwh")
            scan.set_scan_definition_name(f"smoke_test_{method_key}")
            scan.add_configuration_yaml_str(config)
            scan.add_sodacl_yaml_str(SMOKE_CHECK_YAML)

            print("  Executing scan...")
            scan.execute()

            logs = scan.get_logs_text()
            print("  Logs (first 500 chars):")
            print(logs[:500])

            if scan.has_error_logs():
                print(f"\n  RESULT: FAILED")
                results[method_key] = {
                    "success": False,
                    "error": scan.get_error_logs_text()[:500]
                }
            else:
                scan_results = scan.get_scan_results()
                checks = scan_results.get('checks', [])
                print(f"\n  RESULT: SUCCESS! Checks executed: {len(checks)}")
                results[method_key] = {
                    "success": True,
                    "checks_executed": len(checks),
                    "results": scan_results
                }
        except Exception as e:
            print(f"  EXCEPTION: {str(e)[:500]}")
            results[method_key] = {
                "success": False,
                "error": str(e)[:500]
            }

    # Summary
    print("\n" + "=" * 60)
    print("SMOKE TEST SUMMARY")
    print("=" * 60)

    working_methods = []
    for method_key, method_name in auth_methods:
        status = "PASS" if results[method_key]["success"] else "FAIL"
        print(f"  {method_name}: {status}")
        if results[method_key]["success"]:
            working_methods.append(method_key)

    print("=" * 60)

    if working_methods:
        print(f"\nWORKING METHODS: {working_methods}")
        print(f"RECOMMENDED: {working_methods[0]}")
    else:
        print("\nNo authentication method worked!")
        print("Check credentials and network connectivity.")

    return {
        "mode": "smoke_test",
        "working_methods": working_methods,
        "recommended": working_methods[0] if working_methods else None,
        "results": results
    }

# %% [markdown]
# ## 11. Main Execution
#
# Orchestrate the complete scan flow.

# %%
def execute_suite(suite_id: int, run_id: str) -> Dict[str, Any]:
    """
    Execute all checks in a suite.

    Args:
        suite_id: Suite to execute
        run_id: Unique run identifier

    Returns:
        Execution summary
    """
    print("=" * 60)
    print(f"DQ CHECKER SCAN - Suite: {suite_id}, Run: {run_id}")
    print("=" * 60)

    conn = None
    execution_log_id = None
    yaml_content = ""
    error_message = None

    try:
        # ===============================================================
        # STEP 1: READ
        # ===============================================================
        print("\n[1/5] READ: Connecting to metadata DB...")
        conn = get_metadata_connection()

        print("[1/5] READ: Creating execution log...")
        execution_log_id = create_execution_log(conn, run_id, suite_id)
        print(f"       Execution Log ID: {execution_log_id}")

        print("[1/5] READ: Fetching checks...")
        checks_df = read_suite_checks(conn, suite_id)
        print(f"       Found {len(checks_df)} enabled checks")

        if checks_df.empty:
            print("       No checks to execute. Exiting.")
            return {"run_id": run_id, "status": "no_checks", "total": 0}

        # ===============================================================
        # STEP 2: YAML
        # ===============================================================
        print("\n[2/5] YAML: Generating SodaCL...")
        yaml_content = generate_yaml_from_checks(checks_df)
        print(f"       Generated {len(yaml_content)} bytes of YAML")

        # ===============================================================
        # STEP 3: EXECUTE
        # ===============================================================
        print("\n[3/5] EXECUTE: Running Soda scan...")
        dwh_config = get_dwh_config_yaml()
        scan_output = execute_soda_scan(yaml_content, dwh_config, run_id)

        scan_results = scan_output['results']
        soda_logs = scan_output['logs']

        if scan_output['has_errors']:
            print(f"       WARNING: Scan had errors")
            error_message = scan_output['error_logs']

        print(f"       Executed {len(scan_results.get('checks', []))} checks")

        # ===============================================================
        # STEP 4: PARSE
        # ===============================================================
        print("\n[4/5] PARSE: Extracting results...")
        results = parse_scan_results(scan_results)
        counts = count_outcomes(results)
        print(f"       Passed: {counts['passed']}, Failed: {counts['failed']}, Warned: {counts['warned']}")

        # ===============================================================
        # STEP 5: WRITE
        # ===============================================================
        print("\n[5/5] WRITE: Storing results...")

        print("       Writing to SQL DB (via SPs)...")
        write_results_to_db(conn, execution_log_id, run_id, results)
        update_execution_log(conn, execution_log_id, counts, yaml_content, error_message)

        print("       Writing to OneLake...")
        log_path = write_to_onelake(run_id, execution_log_id, suite_id,
                                     scan_results, soda_logs, yaml_content, counts)
        print(f"       JSON log: {log_path}")

        # ===============================================================
        # DONE
        # ===============================================================
        print("\n" + "=" * 60)
        print("SCAN COMPLETE")
        print(f"  Run ID: {run_id}")
        print(f"  Total:  {counts['total']}")
        print(f"  Passed: {counts['passed']}")
        print(f"  Failed: {counts['failed']}")
        print(f"  Warned: {counts['warned']}")
        print("=" * 60)

        return {
            "run_id": run_id,
            "execution_log_id": execution_log_id,
            "status": "completed",
            "has_failures": counts['failed'] > 0,
            **counts
        }

    except Exception as e:
        error_message = str(e)
        print(f"\nERROR: {error_message}")

        # Update execution log with error
        if conn and execution_log_id:
            try:
                update_execution_log(conn, execution_log_id,
                                    {'total': 0, 'passed': 0, 'failed': 0, 'warned': 0},
                                    yaml_content, error_message)
            except:
                pass

        raise

    finally:
        # Fabric connections don't need explicit close
        pass

# %% [markdown]
# ## 12. Run Scan
#
# Execute smoke test or full suite based on configuration.

# %%
# Execute based on mode
if SMOKE_TEST:
    print("Running in SMOKE TEST mode...")
    print("Testing Soda authentication methods against target DWH")
    print("Set SMOKE_TEST = False for full suite execution\n")
    result = run_smoke_test()
else:
    print("Running in FULL SUITE mode...")
    result = execute_suite(SUITE_ID, RUN_ID)

# Display result
print(f"\nResult: {json.dumps(result, indent=2)}")

# %% [markdown]
# ## 13. Pipeline Integration (Optional)
#
# Uncomment to fail the pipeline if any checks failed.

# %%
# Uncomment to fail pipeline on DQ failures
# if result.get('has_failures'):
#     raise Exception(f"DQ validation failed: {result['failed']} checks failed out of {result['total']}")

# %% [markdown]
# ---
# ## Appendix A: Generated YAML Preview
#
# Uncomment to view the generated SodaCL YAML for debugging.

# %%
# Preview generated YAML (for debugging)
# print(yaml_content)

# %% [markdown]
# ## Appendix B: Pre-installed vs Pip Packages
#
# **Pre-installed in Fabric Python Notebooks:**
# - notebookutils, pandas, DuckDB, Polars, Scikit-learn, delta-rs
# - Matplotlib, Seaborn, Plotly, pyodbc
#
# **Installed via pip (line 46):**
# - soda-core-sqlserver, soda-core-fabric
