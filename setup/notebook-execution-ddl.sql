-- ============================================================================
-- DQ CHECKER - Notebook Execution Schema
-- ============================================================================
-- Based on Legacy: meta.dq_execution_logs, meta.dq_results
-- SPs follow Legacy pattern
-- Run AFTER simplified-schema-minimal-ddl.sql
-- ============================================================================

DROP PROCEDURE IF EXISTS dbo.sp_create_execution_log;
DROP PROCEDURE IF EXISTS dbo.sp_update_execution_log;
DROP PROCEDURE IF EXISTS dbo.sp_insert_result;
GO

DROP TABLE IF EXISTS dbo.dq_results;
DROP TABLE IF EXISTS dbo.dq_execution_logs;
GO

-- ============================================================================
-- TABLE: dq_execution_logs
-- ============================================================================

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
GO

CREATE INDEX IX_execution_logs_run ON dbo.dq_execution_logs(run_id);
CREATE INDEX IX_execution_logs_suite ON dbo.dq_execution_logs(suite_id);
GO

-- ============================================================================
-- TABLE: dq_results
-- ============================================================================

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
GO

CREATE INDEX IX_results_run ON dbo.dq_results(run_id);
CREATE INDEX IX_results_execution ON dbo.dq_results(execution_log_id);
GO

-- ============================================================================
-- SP: sp_create_execution_log
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

-- ============================================================================
-- SP: sp_update_execution_log
-- ============================================================================

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

-- ============================================================================
-- SP: sp_insert_result
-- ============================================================================

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

PRINT 'Notebook execution schema deployed.';
PRINT 'Tables: dq_execution_logs, dq_results';
PRINT 'SPs: sp_create_execution_log, sp_update_execution_log, sp_insert_result';
GO
