-- ============================================================================
-- Migration: Update stored procedures for dq_sources connection columns
-- ============================================================================

PRINT 'Updating stored procedures for dq_sources...';
GO

CREATE OR ALTER PROCEDURE dbo.sp_create_data_source
    @source_name NVARCHAR(100),
    @source_type NVARCHAR(50) = 'fabric_warehouse',
    @server_name NVARCHAR(255) = NULL,
    @database_name NVARCHAR(255) = NULL,
    @keyvault_uri NVARCHAR(255) = NULL,
    @client_id NVARCHAR(100) = NULL,
    @secret_name NVARCHAR(100) = NULL,
    @description NVARCHAR(500) = NULL,
    @is_active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.dq_sources (
        source_name, source_type, server_name, database_name,
        keyvault_uri, client_id, secret_name, description, is_active
    )
    VALUES (
        @source_name, @source_type, @server_name, @database_name,
        @keyvault_uri, @client_id, @secret_name, @description, @is_active
    );

    SELECT * FROM dbo.dq_sources WHERE source_id = SCOPE_IDENTITY();
END;
GO

PRINT 'Updated: sp_create_data_source';
GO

CREATE OR ALTER PROCEDURE dbo.sp_update_data_source
    @source_id INT,
    @source_name NVARCHAR(100),
    @source_type NVARCHAR(50) = NULL,
    @server_name NVARCHAR(255) = NULL,
    @database_name NVARCHAR(255) = NULL,
    @keyvault_uri NVARCHAR(255) = NULL,
    @client_id NVARCHAR(100) = NULL,
    @secret_name NVARCHAR(100) = NULL,
    @description NVARCHAR(500) = NULL,
    @is_active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.dq_sources
    SET source_name = @source_name,
        source_type = COALESCE(@source_type, source_type),
        server_name = COALESCE(@server_name, server_name),
        database_name = COALESCE(@database_name, database_name),
        keyvault_uri = @keyvault_uri,
        client_id = @client_id,
        secret_name = @secret_name,
        description = @description,
        is_active = @is_active,
        updated_at = GETDATE()
    WHERE source_id = @source_id;

    SELECT * FROM dbo.dq_sources WHERE source_id = @source_id;
END;
GO

PRINT 'Updated: sp_update_data_source';
GO

-- Update view to include new columns
CREATE OR ALTER VIEW dbo.vw_active_data_sources AS
SELECT
    source_id,
    source_name,
    source_type,
    server_name,
    database_name,
    keyvault_uri,
    client_id,
    secret_name,
    description
FROM dbo.dq_sources
WHERE is_active = 1;
GO

PRINT 'Updated: vw_active_data_sources';
GO

PRINT 'Stored procedures migration complete!';
GO
