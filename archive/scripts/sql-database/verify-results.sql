-- Verify DQ Checker Results
-- ============================================================================
-- Run after notebook execution to verify results were written
-- ============================================================================

PRINT 'Verifying DQ Checker Results...';
PRINT '';
GO

-- Latest execution logs
PRINT '=== Latest Execution Logs ===';
SELECT TOP 5
    execution_log_id,
    run_id,
    suite_id,
    execution_status,
    total_checks,
    checks_passed,
    checks_failed,
    checks_warned,
    created_at
FROM dbo.dq_execution_logs
ORDER BY created_at DESC;
GO

-- Latest results
PRINT '';
PRINT '=== Latest Check Results ===';
SELECT TOP 10
    r.result_id,
    r.run_id,
    r.check_name,
    r.check_outcome,
    r.check_value,
    r.created_at
FROM dbo.dq_results r
ORDER BY r.created_at DESC;
GO

-- Summary by outcome
PRINT '';
PRINT '=== Results Summary (Last Run) ===';
DECLARE @last_run_id NVARCHAR(50);
SELECT TOP 1 @last_run_id = run_id FROM dbo.dq_execution_logs ORDER BY created_at DESC;

SELECT
    check_outcome,
    COUNT(*) AS count
FROM dbo.dq_results
WHERE run_id = @last_run_id
GROUP BY check_outcome;
GO

PRINT '';
PRINT 'Verification complete!';
GO
