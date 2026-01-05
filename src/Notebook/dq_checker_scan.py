# Fabric Python Notebook - DQ Checker Scan Executor
# ============================================================================
# Execute data quality checks against Fabric Data Warehouse using Soda Core.
# Designed for Fabric Pipeline integration with parameterized execution.
# ============================================================================

# %% [markdown]
# # DQ Checker - Soda Core Scan Executor
#
# **Execution Flow:**
# ```
# Parameters → Read Config → Generate YAML → Execute Soda → Write Results
# ```
#
# **Pipeline Integration:** Pass parameters via Fabric Pipeline activity.

# %%
# Install dependencies (cached after first run)
%pip install soda-core-sqlserver --quiet

# %% [markdown]
# ## Parameters
#
# Configure execution via Fabric Pipeline parameters or manual override.

# %%
# =============================================================================
# PIPELINE PARAMETERS
# =============================================================================
# These values are set by Fabric Pipeline or manually for testing.
# In Pipeline: Use "Parameters" section of notebook activity.

# Execution scope
SUITE_ID: int = 1                    # Suite to execute (0 = use TESTCASE_IDS)
TESTCASE_IDS: str = ""               # Comma-separated testcase IDs (optional)

# Pipeline behavior
FAIL_ON_ERROR: bool = True           # Raise exception if any check fails
SMOKE_TEST: bool = False             # True = test connection only, skip execution

# =============================================================================
# KEY VAULT CONFIGURATION
# =============================================================================
# All secrets and configuration come from Key Vault
KEY_VAULT_URI: str = "https://chwakv.vault.azure.net/"

# Secret names in Key Vault
SECRET_CLIENT_ID: str = "dq-checker-spn-client-id"
SECRET_CLIENT_SECRET: str = "dq-checker-spn-secret"
SECRET_META_DB_SERVER: str = "dq-checker-meta-db-server"
SECRET_META_DB_NAME: str = "dq-checker-meta-db-name"

# =============================================================================
# ONELAKE OUTPUT
# =============================================================================
LAKEHOUSE_PATH: str = "/lakehouse/default/Files"
LOGS_FOLDER: str = "dq_logs"

# %% [markdown]
# ## Imports & Initialization

# %%
import json
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

import pandas as pd
import pyodbc
from soda.scan import Scan
import notebookutils

# Generate unique run identifier
RUN_ID = str(uuid.uuid4())[:8]
print(f"DQ Checker Scan - Run ID: {RUN_ID}")

# %% [markdown]
# ## Configuration Loader

# %%
@dataclass
class DQConfig:
    """Configuration for DQ Checker execution."""

    # Credentials (from Key Vault)
    client_id: str = ""
    client_secret: str = ""

    # Metadata DB connection
    meta_db_server: str = ""
    meta_db_name: str = ""

    # Execution parameters
    suite_id: int = 0
    testcase_ids: List[int] = field(default_factory=list)
    fail_on_error: bool = True
    smoke_test: bool = False

    # Output paths
    lakehouse_path: str = "/lakehouse/default/Files"
    logs_folder: str = "dq_logs"

    @classmethod
    def from_keyvault(cls, kv_uri: str, **overrides) -> "DQConfig":
        """
        Load configuration from Azure Key Vault.

        Args:
            kv_uri: Key Vault URI
            **overrides: Override specific config values

        Returns:
            Configured DQConfig instance
        """
        def get_secret(name: str, default: str = "") -> str:
            try:
                return notebookutils.credentials.getSecret(kv_uri, name)
            except Exception:
                return default

        config = cls(
            client_id=get_secret(SECRET_CLIENT_ID),
            client_secret=get_secret(SECRET_CLIENT_SECRET),
            meta_db_server=get_secret(SECRET_META_DB_SERVER),
            meta_db_name=get_secret(SECRET_META_DB_NAME),
        )

        # Apply overrides
        for key, value in overrides.items():
            if hasattr(config, key):
                setattr(config, key, value)

        return config


# Load configuration
config = DQConfig.from_keyvault(
    KEY_VAULT_URI,
    suite_id=SUITE_ID,
    testcase_ids=[int(x.strip()) for x in TESTCASE_IDS.split(",") if x.strip()],
    fail_on_error=FAIL_ON_ERROR,
    smoke_test=SMOKE_TEST,
    lakehouse_path=LAKEHOUSE_PATH,
    logs_folder=LOGS_FOLDER,
)

print(f"Suite ID: {config.suite_id}")
print(f"Testcase IDs: {config.testcase_ids or 'All in suite'}")
print(f"Fail on Error: {config.fail_on_error}")

# %% [markdown]
# ## Database Connection

# %%
class MetadataDB:
    """Connection manager for DQ Checker metadata database."""

    def __init__(self, config: DQConfig):
        self.config = config
        self._conn: Optional[pyodbc.Connection] = None

    def connect(self) -> pyodbc.Connection:
        """Establish database connection using Service Principal auth."""
        if self._conn is None:
            conn_str = (
                f"Driver={{ODBC Driver 18 for SQL Server}};"
                f"Server={self.config.meta_db_server},1433;"
                f"Database={self.config.meta_db_name};"
                f"Authentication=ActiveDirectoryServicePrincipal;"
                f"UID={self.config.client_id};"
                f"PWD={self.config.client_secret};"
                f"Encrypt=yes;TrustServerCertificate=no;"
            )
            self._conn = pyodbc.connect(conn_str)
        return self._conn

    def close(self):
        """Close database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None

    def query(self, sql: str) -> pd.DataFrame:
        """Execute query and return DataFrame."""
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        return pd.DataFrame.from_records(rows, columns=columns)

    def execute(self, sql: str) -> Any:
        """Execute SQL and return first result."""
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute(sql)
        result = cursor.fetchone()
        conn.commit()
        return result

# %% [markdown]
# ## Data Source Manager

# %%
@dataclass
class DataSource:
    """Represents a data source from dq_sources table."""
    source_id: int
    source_name: str
    source_type: str
    server_name: str
    database_name: str
    keyvault_uri: Optional[str] = None
    client_id: Optional[str] = None
    secret_name: Optional[str] = None

    def get_credentials(self, default_config: DQConfig) -> tuple:
        """
        Get credentials for this source.

        Uses source-specific credentials if defined, otherwise falls back to defaults.

        Returns:
            Tuple of (client_id, client_secret)
        """
        # Use source-specific or default client_id
        cid = self.client_id or default_config.client_id

        # Get secret from source-specific or default Key Vault
        kv_uri = self.keyvault_uri or KEY_VAULT_URI
        secret_name = self.secret_name or SECRET_CLIENT_SECRET

        secret = notebookutils.credentials.getSecret(kv_uri, secret_name)
        return cid, secret

    def get_soda_yaml(self, client_id: str, client_secret: str) -> str:
        """Generate Soda connection YAML for this source."""
        return f"""
data_source {self.source_name}:
  type: sqlserver
  driver: ODBC Driver 18 for SQL Server
  host: {self.server_name}
  port: '1433'
  database: {self.database_name}
  authentication: ActiveDirectoryServicePrincipal
  username: {client_id}
  password: {client_secret}
  encrypt: true
  trust_server_certificate: false
"""


class DataSourceManager:
    """Manages data sources from metadata database."""

    def __init__(self, db: MetadataDB):
        self.db = db
        self._cache: Dict[int, DataSource] = {}

    def get(self, source_id: int) -> DataSource:
        """Get data source by ID."""
        if source_id not in self._cache:
            df = self.db.query(f"""
                SELECT source_id, source_name, source_type, server_name,
                       database_name, keyvault_uri, client_id, secret_name
                FROM dq_sources WHERE source_id = {source_id}
            """)
            if df.empty:
                raise ValueError(f"Data source {source_id} not found")
            row = df.iloc[0]
            self._cache[source_id] = DataSource(
                source_id=row['source_id'],
                source_name=row['source_name'],
                source_type=row['source_type'] or 'fabric_warehouse',
                server_name=row['server_name'],
                database_name=row['database_name'],
                keyvault_uri=row['keyvault_uri'],
                client_id=row['client_id'],
                secret_name=row['secret_name'],
            )
        return self._cache[source_id]

# %% [markdown]
# ## YAML Generator

# %%
class SodaYAMLGenerator:
    """
    Generates SodaCL YAML from check definitions.

    Supports all 22 Soda check types including freshness, schema,
    reference, scalar comparison, and custom SQL.
    """

    YAML_SPECIAL_CHARS = {':', '#', '{', '}', '[', ']', '&', '*', '!', '|', '>', '@', '`', '%'}

    @staticmethod
    def safe_value(value: Optional[str]) -> str:
        """Escape special characters for YAML output."""
        if value is None:
            return ''
        if not isinstance(value, str):
            value = str(value)
        value = value.strip()
        if not value:
            return ''

        if '\n' in value:
            indented = '\n        '.join(value.split('\n'))
            return f'|\n        {indented}'

        needs_quoting = (
            any(c in value for c in SodaYAMLGenerator.YAML_SPECIAL_CHARS) or
            value.startswith("'") or value.startswith('"') or
            value.startswith(' ') or value.endswith(' ')
        )

        if needs_quoting:
            escaped = value.replace('\\', '\\\\').replace('"', '\\"')
            return f'"{escaped}"'

        return value

    def generate(self, checks_df: pd.DataFrame) -> str:
        """
        Generate SodaCL YAML from checks DataFrame.

        Args:
            checks_df: DataFrame with check definitions from vw_checks_complete

        Returns:
            SodaCL YAML string
        """
        if checks_df.empty:
            return "# No checks defined\n"

        yaml_lines = []

        for (schema_name, table_name), table_checks in checks_df.groupby(['schema_name', 'table_name']):
            table_str = str(table_name)

            # Handle special characters in table names
            if ' ' in table_str or '-' in table_str:
                fq_table = f'"{table_str}"'
            elif pd.notna(schema_name) and '.' not in table_str:
                fq_table = f"{schema_name}.{table_str}"
            else:
                fq_table = table_str

            check_lines = []
            for _, check in table_checks.iterrows():
                check_lines.extend(self._generate_check(check))

            if check_lines:
                yaml_lines.append(f"checks for {fq_table}:")
                yaml_lines.extend(check_lines)
                yaml_lines.append("")

        return "\n".join(yaml_lines)

    def _generate_check(self, check: pd.Series) -> List[str]:
        """Generate YAML for a single check."""
        metric = check['metric']

        # Route to specialized generators
        generators = {
            'freshness': self._gen_freshness,
            'schema': self._gen_schema,
            'reference': self._gen_reference,
            'user_defined': self._gen_custom_sql,
            'custom_sql': self._gen_custom_sql,
            'scalar_comparison': self._gen_scalar,
        }

        if metric in generators:
            return generators[metric](check)

        return self._gen_standard(check)

    def _gen_standard(self, check: pd.Series) -> List[str]:
        """Generate standard metric check."""
        lines = []
        metric = check['metric']
        column = check.get('column_name_quoted') or check.get('column_name')

        column_metrics = [
            'missing_count', 'missing_percent', 'duplicate_count', 'duplicate_percent',
            'min', 'max', 'avg', 'sum', 'invalid_count', 'invalid_percent',
            'valid_count', 'avg_length', 'min_length'
        ]

        if pd.notna(column) and metric in column_metrics:
            lines.append(f"  - {metric}({column}):")
        else:
            lines.append(f"  - {metric}:")

        check_name = self._format_check_name(check)
        lines.append(f'      name: "{check_name}"')
        lines.extend(self._gen_thresholds(check))

        return lines

    def _gen_thresholds(self, check: pd.Series) -> List[str]:
        """Generate warn/fail threshold lines."""
        lines = []

        if pd.notna(check.get('warn_threshold')) and pd.notna(check.get('warn_comparison')):
            op = '=' if check['warn_comparison'] == '==' else check['warn_comparison']
            lines.append(f"      warn: when {op} {check['warn_threshold']}")

        if pd.notna(check.get('fail_threshold')) and pd.notna(check.get('fail_comparison')):
            op = '=' if check['fail_comparison'] == '==' else check['fail_comparison']
            lines.append(f"      fail: when {op} {check['fail_threshold']}")

        return lines

    def _gen_freshness(self, check: pd.Series) -> List[str]:
        """Generate freshness check."""
        if not all(pd.notna(check.get(f)) for f in ['freshness_column', 'freshness_threshold_value', 'freshness_threshold_unit']):
            return []

        col = check['freshness_column']
        val = int(check['freshness_threshold_value']) if float(check['freshness_threshold_value']).is_integer() else check['freshness_threshold_value']
        unit = check['freshness_threshold_unit']

        return [
            f"  - freshness({col}) < {val}{unit}:",
            f'      name: "{self._format_check_name(check)}"'
        ]

    def _gen_schema(self, check: pd.Series) -> List[str]:
        """Generate schema check."""
        lines = [
            "  - schema:",
            f'      name: "{self._format_check_name(check)}"'
        ]

        if pd.notna(check.get('schema_required_columns')):
            try:
                required = json.loads(check['schema_required_columns'])
                if required:
                    lines.append("      fail:")
                    lines.append("        when required column missing:")
                    for col in required:
                        lines.append(f"          - {col}")
            except json.JSONDecodeError:
                pass

        return lines

    def _gen_reference(self, check: pd.Series) -> List[str]:
        """Generate reference integrity check."""
        if not all(pd.notna(check.get(f)) for f in ['reference_table', 'reference_column']):
            return []

        src_col = check.get('column_name_quoted') or check.get('column_name')
        ref_table = check['reference_table']
        ref_col = check.get('reference_column_quoted') or check['reference_column']
        src_table = check['table_name']
        schema = check.get('schema_name', 'dbo')

        return [
            "  - failed rows:",
            f'      name: "{self._format_check_name(check)}"',
            "      fail query: |",
            f"        SELECT * FROM {schema}.{src_table}",
            f"        WHERE {src_col} IS NOT NULL",
            f"          AND {src_col} NOT IN (SELECT {ref_col} FROM dbo.{ref_table})"
        ]

    def _gen_custom_sql(self, check: pd.Series) -> List[str]:
        """Generate custom SQL check."""
        if not pd.notna(check.get('custom_sql_query')):
            return []

        sql = str(check['custom_sql_query']).strip()
        metric_name = re.sub(r'[^a-zA-Z0-9_]', '_', check['check_name'].lower())
        metric_name = re.sub(r'_+', '_', metric_name).strip('_')

        threshold = "= 0"
        if pd.notna(check.get('fail_comparison')) and pd.notna(check.get('fail_threshold')):
            op = '=' if check['fail_comparison'] == '==' else check['fail_comparison']
            threshold = f"{op} {check['fail_threshold']}"

        lines = [
            f"  - {metric_name} {threshold}:",
            f'      name: "{self._format_check_name(check)}"',
            f"      {metric_name} query: |"
        ]
        for sql_line in sql.split('\n'):
            lines.append(f"        {sql_line}")

        return lines

    def _gen_scalar(self, check: pd.Series) -> List[str]:
        """Generate scalar comparison check."""
        if not all(pd.notna(check.get(f)) for f in ['scalar_query_a', 'scalar_query_b']):
            return []

        qa = str(check['scalar_query_a']).strip()
        qb = str(check['scalar_query_b']).strip()
        op = check.get('scalar_operator', '==')

        where_map = {
            '==': 'query_a != query_b', '!=': 'query_a = query_b',
            '>': 'query_a <= query_b', '>=': 'query_a < query_b',
            '<': 'query_a >= query_b', '<=': 'query_a > query_b'
        }

        return [
            "  - failed rows:",
            f'      name: "{self._format_check_name(check)}"',
            "      fail query: |",
            "        WITH comparison AS (",
            f"          SELECT ({qa}) AS query_a, ({qb}) AS query_b",
            "        )",
            "        SELECT query_a, query_b, query_a - query_b AS difference",
            "        FROM comparison",
            f"        WHERE {where_map.get(op, 'query_a != query_b')}"
        ]

    def _format_check_name(self, check: pd.Series) -> str:
        """Format check name with ID for result linking."""
        name = check['check_name']
        if pd.notna(check.get('check_id')):
            name = f"{name} [check_id:{check['check_id']}]"
        return name

# %% [markdown]
# ## Scan Executor

# %%
@dataclass
class ScanResult:
    """Results from a Soda scan execution."""
    run_id: str
    execution_log_id: int
    total: int = 0
    passed: int = 0
    failed: int = 0
    warned: int = 0
    has_errors: bool = False
    error_message: Optional[str] = None
    results: List[Dict] = field(default_factory=list)
    yaml_content: str = ""
    logs: str = ""


class SodaExecutor:
    """Executes Soda scans against data sources."""

    def __init__(self, config: DQConfig):
        self.config = config

    def execute(self, yaml_content: str, connection_yaml: str, run_id: str) -> Dict[str, Any]:
        """
        Execute Soda scan.

        Args:
            yaml_content: SodaCL check definitions
            connection_yaml: Soda data source configuration
            run_id: Unique run identifier

        Returns:
            Dictionary with scan results, logs, and error status
        """
        scan = Scan()
        scan.set_data_source_name("fabric_dwh")
        scan.set_scan_definition_name(f"dq_checker_{run_id}")
        scan.add_configuration_yaml_str(connection_yaml)
        scan.add_sodacl_yaml_str(yaml_content)

        scan.execute()

        return {
            "results": scan.get_scan_results(),
            "logs": scan.get_logs_text(),
            "has_errors": scan.has_error_logs(),
            "error_logs": scan.get_error_logs_text() if scan.has_error_logs() else None
        }

    def parse_results(self, scan_results: Dict) -> List[Dict]:
        """Extract structured results from Soda scan output."""
        results = []

        for check in scan_results.get('checks', []):
            check_name = check.get('name', '')
            check_id_match = re.search(r'\[check_id:(\d+)\]', check_name)

            diagnostics = check.get('diagnostics', {})

            results.append({
                'check_id': int(check_id_match.group(1)) if check_id_match else None,
                'check_name': check_name,
                'outcome': check.get('outcome', 'unknown'),
                'value': diagnostics.get('value', check.get('value'))
            })

        return results

# %% [markdown]
# ## Result Writer

# %%
class ResultWriter:
    """Writes scan results to metadata DB and OneLake."""

    def __init__(self, db: MetadataDB, config: DQConfig):
        self.db = db
        self.config = config

    def create_execution_log(self, run_id: str, suite_id: int) -> int:
        """Create execution log entry."""
        result = self.db.execute(
            f"EXEC sp_create_execution_log @run_id='{run_id}', @suite_id={suite_id}"
        )
        return int(result[0])

    def write_results(self, log_id: int, run_id: str, results: List[Dict]):
        """Write individual check results."""
        conn = self.db.connect()
        cursor = conn.cursor()

        for r in results:
            name = str(r['check_name']).replace("'", "''") if r['check_name'] else ''
            outcome = str(r['outcome']).replace("'", "''") if r['outcome'] else ''
            check_id = r['check_id'] if r['check_id'] else 'NULL'
            value = r['value'] if r['value'] is not None else 'NULL'

            cursor.execute(f"""
                EXEC sp_insert_result
                    @run_id='{run_id}', @execution_log_id={log_id},
                    @check_id={check_id}, @check_name='{name}',
                    @check_outcome='{outcome}', @check_value={value}
            """)
            cursor.fetchone()

        conn.commit()

    def update_execution_log(self, log_id: int, result: ScanResult):
        """Update execution log with final status."""
        status = 'failed' if result.error_message else 'completed'
        has_failures = 1 if result.failed > 0 else 0

        yaml_esc = result.yaml_content.replace("'", "''")
        error_esc = result.error_message.replace("'", "''") if result.error_message else ''
        error_param = f"'{error_esc}'" if result.error_message else 'NULL'

        self.db.execute(f"""
            EXEC sp_update_execution_log
                @execution_log_id={log_id}, @status='{status}',
                @total_checks={result.total}, @checks_passed={result.passed},
                @checks_failed={result.failed}, @checks_warned={result.warned},
                @has_failures={has_failures}, @generated_yaml='{yaml_esc}',
                @error_message={error_param}
        """)

    def write_to_onelake(self, result: ScanResult, suite_id: int, scan_output: Dict) -> str:
        """Write full results to OneLake with Hive-style partitioning."""
        now = datetime.utcnow()

        payload = {
            "run_id": result.run_id,
            "execution_log_id": result.execution_log_id,
            "suite_id": suite_id,
            "timestamp": now.isoformat(),
            "year": now.year,
            "month": now.month,
            "day": now.day,
            "summary": {
                "total": result.total,
                "passed": result.passed,
                "failed": result.failed,
                "warned": result.warned
            },
            "scan_results": scan_output.get('results', {}),
            "soda_logs": scan_output.get('logs', ''),
            "yaml_content": result.yaml_content
        }

        partition = f"year={now.year}/month={now.month:02d}/day={now.day:02d}"
        path = f"{self.config.lakehouse_path}/{self.config.logs_folder}/{partition}/execution_{result.run_id}.json"

        notebookutils.fs.put(path, json.dumps(payload, indent=2, default=str), overwrite=True)
        return path

# %% [markdown]
# ## Orchestrator

# %%
class DQCheckerOrchestrator:
    """
    Main orchestrator for DQ Checker scan execution.

    Coordinates reading checks, generating YAML, executing Soda scans,
    and writing results to metadata DB and OneLake.
    """

    def __init__(self, config: DQConfig):
        self.config = config
        self.db = MetadataDB(config)
        self.sources = DataSourceManager(self.db)
        self.yaml_gen = SodaYAMLGenerator()
        self.executor = SodaExecutor(config)
        self.writer = ResultWriter(self.db, config)

    def run(self, run_id: str) -> ScanResult:
        """
        Execute DQ checks for configured suite/testcases.

        Args:
            run_id: Unique run identifier

        Returns:
            ScanResult with execution details
        """
        result = ScanResult(run_id=run_id, execution_log_id=0)

        try:
            # Create execution log
            print(f"\n[1/5] Creating execution log...")
            result.execution_log_id = self.writer.create_execution_log(
                run_id, self.config.suite_id
            )
            print(f"      Log ID: {result.execution_log_id}")

            # Fetch checks
            print(f"\n[2/5] Fetching checks...")
            checks_df = self._fetch_checks()
            print(f"      Found {len(checks_df)} enabled checks")

            if checks_df.empty:
                print("      No checks to execute.")
                return result

            # Get data source and generate connection YAML
            source_id = checks_df['source_id'].iloc[0]
            source = self.sources.get(source_id)
            cid, secret = source.get_credentials(self.config)
            conn_yaml = source.get_soda_yaml(cid, secret)

            # Generate check YAML
            print(f"\n[3/5] Generating SodaCL YAML...")
            result.yaml_content = self.yaml_gen.generate(checks_df)
            print(f"      Generated {len(result.yaml_content)} bytes")

            # Execute scan
            print(f"\n[4/5] Executing Soda scan against {source.source_name}...")
            scan_output = self.executor.execute(result.yaml_content, conn_yaml, run_id)
            result.logs = scan_output['logs']

            if scan_output['has_errors']:
                result.has_errors = True
                result.error_message = scan_output['error_logs']

            # Parse results
            result.results = self.executor.parse_results(scan_output['results'])
            result.total = len(result.results)
            result.passed = len([r for r in result.results if r['outcome'] == 'pass'])
            result.failed = len([r for r in result.results if r['outcome'] == 'fail'])
            result.warned = len([r for r in result.results if r['outcome'] == 'warn'])

            # Write results
            print(f"\n[5/5] Writing results...")
            self.writer.write_results(result.execution_log_id, run_id, result.results)
            self.writer.update_execution_log(result.execution_log_id, result)

            log_path = self.writer.write_to_onelake(result, self.config.suite_id, scan_output)
            print(f"      OneLake: {log_path}")

            # Summary
            print(f"\n{'='*60}")
            print(f"SCAN COMPLETE - Run ID: {run_id}")
            print(f"  Total:  {result.total}")
            print(f"  Passed: {result.passed}")
            print(f"  Failed: {result.failed}")
            print(f"  Warned: {result.warned}")
            print(f"{'='*60}")

            return result

        except Exception as e:
            result.error_message = str(e)
            print(f"\nERROR: {e}")

            if result.execution_log_id:
                try:
                    self.writer.update_execution_log(result.execution_log_id, result)
                except Exception:
                    pass

            raise

        finally:
            self.db.close()

    def _fetch_checks(self) -> pd.DataFrame:
        """Fetch checks based on suite_id or testcase_ids."""
        if self.config.testcase_ids:
            ids = ",".join(str(x) for x in self.config.testcase_ids)
            where = f"c.testcase_id IN ({ids})"
        else:
            where = f"""
                c.testcase_id IN (
                    SELECT testcase_id FROM suites_testcases
                    WHERE suite_id = {self.config.suite_id}
                )
            """

        return self.db.query(f"""
            SELECT c.*, t.schema_name, t.source_id
            FROM vw_checks_complete c
            JOIN dq_testcases t ON c.testcase_id = t.testcase_id
            WHERE {where} AND c.is_enabled = 1
            ORDER BY c.check_id
        """)

# %% [markdown]
# ## Execution

# %%
if config.smoke_test:
    print("="*60)
    print("SMOKE TEST MODE")
    print("="*60)
    print("Testing connection to metadata DB only.")

    db = MetadataDB(config)
    try:
        df = db.query("SELECT COUNT(*) AS count FROM dq_sources")
        print(f"Connection OK - {df.iloc[0]['count']} data sources found")
    finally:
        db.close()

    result = ScanResult(run_id=RUN_ID, execution_log_id=0)
else:
    orchestrator = DQCheckerOrchestrator(config)
    result = orchestrator.run(RUN_ID)

# %% [markdown]
# ## Pipeline Exit

# %%
# Fail pipeline if checks failed and FAIL_ON_ERROR is True
if config.fail_on_error and result.failed > 0:
    raise Exception(
        f"DQ validation failed: {result.failed} of {result.total} checks failed. "
        f"Run ID: {result.run_id}"
    )

print(f"\nExecution completed successfully. Run ID: {result.run_id}")
