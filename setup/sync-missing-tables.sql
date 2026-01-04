-- ============================================================================
-- DQ CHECKER - Sync Missing Tables (Incremental Update)
-- ============================================================================
-- Adds: dq_suites, suites_testcases, dq_execution_logs, dq_results
-- Does NOT drop existing tables with data
-- ============================================================================

-- ============================================================================
-- TABLE: dq_suites (missing)
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dq_suites')
BEGIN
    CREATE TABLE dbo.dq_suites (
        suite_id INT IDENTITY(1,1) PRIMARY KEY,
        suite_name NVARCHAR(255) NOT NULL,
        suite_code NVARCHAR(50),
        description NVARCHAR(1000),
        category NVARCHAR(100),
        data_domain NVARCHAR(100),
        execution_order INT DEFAULT 0,
        owner NVARCHAR(100),
        tags NVARCHAR(500),
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_dq_suites_category ON dbo.dq_suites(category);
    CREATE INDEX IX_dq_suites_domain ON dbo.dq_suites(data_domain);

    PRINT 'Created: dq_suites';
END
ELSE
BEGIN
    PRINT 'Exists: dq_suites';
END;
GO

-- ============================================================================
-- TABLE: suites_testcases (missing)
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'suites_testcases')
BEGIN
    CREATE TABLE dbo.suites_testcases (
        suite_id INT NOT NULL REFERENCES dbo.dq_suites(suite_id) ON DELETE CASCADE,
        testcase_id INT NOT NULL REFERENCES dbo.dq_testcases(testcase_id) ON DELETE CASCADE,
        created_at DATETIME2 DEFAULT GETDATE(),
        PRIMARY KEY (suite_id, testcase_id)
    );

    PRINT 'Created: suites_testcases';
END
ELSE
BEGIN
    PRINT 'Exists: suites_testcases';
END;
GO

-- ============================================================================
-- TABLE: dq_execution_logs (for notebook)
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dq_execution_logs')
BEGIN
    CREATE TABLE dbo.dq_execution_logs (
        execution_log_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        run_id NVARCHAR(50) NOT NULL,
        suite_id INT NULL REFERENCES dbo.dq_suites(suite_id),
        source_id INT NULL REFERENCES dbo.dq_sources(source_id),
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
    );

    CREATE INDEX IX_execution_logs_run ON dbo.dq_execution_logs(run_id);
    CREATE INDEX IX_execution_logs_suite ON dbo.dq_execution_logs(suite_id);

    PRINT 'Created: dq_execution_logs';
END
ELSE
BEGIN
    PRINT 'Exists: dq_execution_logs';
END;
GO

-- ============================================================================
-- TABLE: dq_results (for notebook)
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'dq_results')
BEGIN
    CREATE TABLE dbo.dq_results (
        result_id INT IDENTITY(1,1) PRIMARY KEY,
        run_id NVARCHAR(50) NOT NULL,
        execution_log_id BIGINT NOT NULL REFERENCES dbo.dq_execution_logs(execution_log_id),
        check_id INT NULL REFERENCES dbo.dq_checks(check_id),
        check_name NVARCHAR(500) NOT NULL,
        check_outcome NVARCHAR(20) NOT NULL,
        check_value DECIMAL(18,4) NULL,
        created_at DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_results_run ON dbo.dq_results(run_id);
    CREATE INDEX IX_results_execution ON dbo.dq_results(execution_log_id);

    PRINT 'Created: dq_results';
END
ELSE
BEGIN
    PRINT 'Exists: dq_results';
END;
GO

-- ============================================================================
-- VIEWS: Update to include suites
-- ============================================================================

CREATE OR ALTER VIEW dbo.vw_orphan_testcases AS
SELECT t.*
FROM dbo.dq_testcases t
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.suites_testcases st WHERE st.testcase_id = t.testcase_id
);
GO
PRINT 'Created/Updated: vw_orphan_testcases';
GO

CREATE OR ALTER VIEW dbo.vw_suite_testcases AS
SELECT
    s.suite_id,
    s.suite_name,
    s.category,
    s.data_domain,
    st.testcase_id,
    t.testcase_name,
    t.source_id,
    ds.source_name,
    t.schema_name,
    t.table_name,
    (SELECT COUNT(*) FROM dbo.dq_checks c WHERE c.testcase_id = t.testcase_id) AS check_count
FROM dbo.dq_suites s
INNER JOIN dbo.suites_testcases st ON s.suite_id = st.suite_id
INNER JOIN dbo.dq_testcases t ON st.testcase_id = t.testcase_id
LEFT JOIN dbo.dq_sources ds ON t.source_id = ds.source_id;
GO
PRINT 'Created/Updated: vw_suite_testcases';
GO

-- ============================================================================
-- STORED PROCEDURES: Execution SPs
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_execution_log
    @run_id NVARCHAR(50),
    @suite_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.dq_execution_logs (run_id, suite_id, execution_status, created_at)
    VALUES (@run_id, @suite_id, 'running', GETDATE());
    SELECT SCOPE_IDENTITY() AS execution_log_id;
END;
GO
PRINT 'Created/Updated: sp_create_execution_log';
GO

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
END;
GO
PRINT 'Created/Updated: sp_update_execution_log';
GO

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
END;
GO
PRINT 'Created/Updated: sp_insert_result';
GO

-- ============================================================================
-- SEED DATA: Default Suite
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.dq_suites WHERE suite_name = 'Daily DQ Checks')
BEGIN
    INSERT INTO dbo.dq_suites (suite_name, suite_code, description, category, data_domain, execution_order, owner)
    VALUES ('Daily DQ Checks', 'SUITE_00001', 'Daily data quality checks for taxi data', 'Production', 'Transportation', 1, 'Data Engineering');
    PRINT 'Inserted seed suite: Daily DQ Checks';
END;
GO

-- ============================================================================
-- SUMMARY
-- ============================================================================

PRINT '';
PRINT '=== SYNC COMPLETE ===';
PRINT '';
SELECT
    'Tables' AS object_type,
    TABLE_NAME AS name
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
AND TABLE_NAME IN ('dq_suites', 'suites_testcases', 'dq_execution_logs', 'dq_results')
ORDER BY TABLE_NAME;
GO
