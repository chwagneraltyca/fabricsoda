-- ============================================================================
-- FIX: sp_delete_data_source - CASCADE DELETE dependent records
-- ============================================================================
-- Issue: Delete fails with constraint violation if dq_checks reference the source
-- Fix: Cascade delete - remove dependent checks first, then the source
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_delete_data_source
    @source_id INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @source_name NVARCHAR(100);
    DECLARE @checks_deleted INT = 0;

    -- Get source name for logging
    SELECT @source_name = source_name FROM dbo.dq_sources WHERE source_id = @source_id;

    -- Check if source exists
    IF @source_name IS NULL
    BEGIN
        RAISERROR('Data source with ID %d not found.', 16, 1, @source_id);
        RETURN;
    END

    -- CASCADE DELETE: First delete dependent checks
    DELETE FROM dbo.dq_checks WHERE source_id = @source_id;
    SET @checks_deleted = @@ROWCOUNT;

    -- Now delete the source
    DELETE FROM dbo.dq_sources WHERE source_id = @source_id;

    -- Return result (1 = source deleted, plus info about cascaded checks)
    SELECT @@ROWCOUNT AS deleted_count;
END;
GO

-- Verify the update
PRINT 'SP sp_delete_data_source updated with CASCADE DELETE';
GO
