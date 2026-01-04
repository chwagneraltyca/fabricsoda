-- ============================================================================
-- Add missing columns to dq_testcases
-- ============================================================================

-- Add schema_name if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'dq_testcases' AND COLUMN_NAME = 'schema_name'
)
BEGIN
    ALTER TABLE dbo.dq_testcases ADD schema_name NVARCHAR(128);
    PRINT 'Added: schema_name to dq_testcases';
END
ELSE
BEGIN
    PRINT 'Exists: schema_name';
END;
GO

-- Add table_name if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'dq_testcases' AND COLUMN_NAME = 'table_name'
)
BEGIN
    ALTER TABLE dbo.dq_testcases ADD table_name NVARCHAR(255);
    PRINT 'Added: table_name to dq_testcases';
END
ELSE
BEGIN
    PRINT 'Exists: table_name';
END;
GO

-- Add updated_at if not exists
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'dq_testcases' AND COLUMN_NAME = 'updated_at'
)
BEGIN
    ALTER TABLE dbo.dq_testcases ADD updated_at DATETIME2 DEFAULT GETDATE();
    PRINT 'Added: updated_at to dq_testcases';
END
ELSE
BEGIN
    PRINT 'Exists: updated_at';
END;
GO

-- Recreate the view now that columns exist
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
PRINT 'Recreated: vw_suite_testcases';
GO

-- Add index on table scope if missing
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_dq_testcases_table' AND object_id = OBJECT_ID('dbo.dq_testcases')
)
BEGIN
    CREATE INDEX IX_dq_testcases_table ON dbo.dq_testcases(source_id, schema_name, table_name);
    PRINT 'Added: IX_dq_testcases_table index';
END;
GO

PRINT '';
PRINT '=== COLUMNS SYNC COMPLETE ===';
