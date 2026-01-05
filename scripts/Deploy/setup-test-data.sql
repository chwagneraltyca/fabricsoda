-- ============================================================================
-- Setup Test Data for DQ Checker End-to-End Testing
-- ============================================================================
-- Creates test data using direct INSERT (to work with current DB schema)
-- ============================================================================

PRINT 'Setting up test data for DQ Checker...';
GO

-- ============================================================================
-- 1. CREATE DATA SOURCE: sample_dwh (if not exists)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.dq_sources WHERE source_name = 'sample_dwh')
BEGIN
    INSERT INTO dbo.dq_sources (source_name, source_type, server_name, database_name, description, is_active)
    VALUES (
        'sample_dwh',
        'fabric_warehouse',
        'yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.datawarehouse.fabric.microsoft.com',
        'sample_dwh',
        'Sample Data Warehouse for DQ testing',
        1
    );
    PRINT 'Created data source: sample_dwh';
END
ELSE
BEGIN
    PRINT 'Data source already exists: sample_dwh';
END
GO

-- ============================================================================
-- 2. CREATE SUITE: DQ_Test (if not exists)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.dq_suites WHERE suite_code = 'DQ_TEST')
BEGIN
    INSERT INTO dbo.dq_suites (suite_name, suite_code, description, category, data_domain, execution_order, owner, is_active)
    VALUES (
        'DQ Test Suite',
        'DQ_TEST',
        'Test suite for end-to-end DQ validation',
        'Test',
        'Testing',
        1,
        'dq_checker',
        1
    );
    PRINT 'Created suite: DQ_TEST';
END
ELSE
BEGIN
    PRINT 'Suite already exists: DQ_TEST';
END
GO

-- ============================================================================
-- 3. CREATE TESTCASE: INFORMATION_SCHEMA.TABLES
-- ============================================================================
DECLARE @source_id INT, @suite_id INT, @testcase_id INT;

SELECT @source_id = source_id FROM dbo.dq_sources WHERE source_name = 'sample_dwh';
SELECT @suite_id = suite_id FROM dbo.dq_suites WHERE suite_code = 'DQ_TEST';

IF NOT EXISTS (
    SELECT 1 FROM dbo.dq_testcases
    WHERE source_id = @source_id AND schema_name = 'INFORMATION_SCHEMA' AND table_name = 'TABLES'
)
BEGIN
    INSERT INTO dbo.dq_testcases (testcase_name, source_id, schema_name, table_name, owner, is_active)
    VALUES (
        'System Tables Check',
        @source_id,
        'INFORMATION_SCHEMA',
        'TABLES',
        'dq_checker',
        1
    );

    SET @testcase_id = SCOPE_IDENTITY();
    PRINT 'Created testcase: System Tables Check (ID: ' + CAST(@testcase_id AS NVARCHAR) + ')';

    -- Link to suite
    INSERT INTO dbo.suites_testcases (suite_id, testcase_id)
    VALUES (@suite_id, @testcase_id);
    PRINT 'Linked testcase to suite';
END
ELSE
BEGIN
    SELECT @testcase_id = testcase_id
    FROM dbo.dq_testcases
    WHERE source_id = @source_id AND schema_name = 'INFORMATION_SCHEMA' AND table_name = 'TABLES';

    PRINT 'Testcase already exists (ID: ' + CAST(@testcase_id AS NVARCHAR) + ')';

    -- Ensure linked to suite
    IF NOT EXISTS (SELECT 1 FROM dbo.suites_testcases WHERE suite_id = @suite_id AND testcase_id = @testcase_id)
    BEGIN
        INSERT INTO dbo.suites_testcases (suite_id, testcase_id)
        VALUES (@suite_id, @testcase_id);
        PRINT 'Linked testcase to suite';
    END
END
GO

-- ============================================================================
-- 4. CREATE CHECK: row_count > 0
-- ============================================================================
DECLARE @source_id INT, @testcase_id INT;

SELECT @source_id = source_id FROM dbo.dq_sources WHERE source_name = 'sample_dwh';
SELECT @testcase_id = testcase_id
FROM dbo.dq_testcases
WHERE source_id = @source_id AND schema_name = 'INFORMATION_SCHEMA' AND table_name = 'TABLES';

IF NOT EXISTS (
    SELECT 1 FROM dbo.dq_checks
    WHERE testcase_id = @testcase_id AND metric = 'row_count'
)
BEGIN
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name,
        check_name, metric, fail_comparison, fail_threshold,
        dimension, severity, owner, is_enabled
    )
    VALUES (
        @testcase_id,
        @source_id,
        'INFORMATION_SCHEMA',
        'TABLES',
        'Tables exist in DWH',
        'row_count',
        '<',
        1,
        'completeness',
        'critical',
        'dq_checker',
        1
    );

    PRINT 'Created check: row_count > 0';
END
ELSE
BEGIN
    PRINT 'Check already exists: row_count';
END
GO

-- ============================================================================
-- SUMMARY
-- ============================================================================
PRINT '';
PRINT '============================================================';
PRINT 'TEST DATA SETUP COMPLETE';
PRINT '============================================================';

SELECT 'Data Source' AS Entity, source_id AS ID, source_name AS Name
FROM dbo.dq_sources WHERE source_name = 'sample_dwh'
UNION ALL
SELECT 'Suite', suite_id, suite_name
FROM dbo.dq_suites WHERE suite_code = 'DQ_TEST'
UNION ALL
SELECT 'Testcase', testcase_id, testcase_name
FROM dbo.dq_testcases WHERE schema_name = 'INFORMATION_SCHEMA' AND table_name = 'TABLES'
UNION ALL
SELECT 'Check', c.check_id, c.check_name
FROM dbo.dq_checks c
WHERE c.schema_name = 'INFORMATION_SCHEMA' AND c.table_name = 'TABLES' AND c.metric = 'row_count';

PRINT '';
PRINT 'Use these IDs in the notebook:';
PRINT '  SUITE_ID = (suite_id from above)';
PRINT '  TESTCASE_IDS = "(testcase_id from above)"';
GO
