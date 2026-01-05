-- Verify vw_checks_complete view exists and has correct columns
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'vw_checks_complete'
ORDER BY ORDINAL_POSITION;
GO

-- Test query for testcase ID 2
SELECT check_id, check_name, metric, schema_name, table_name, source_id
FROM vw_checks_complete
WHERE testcase_id = 2 AND is_enabled = 1;
GO
