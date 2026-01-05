-- ============================================================================
-- Migration: Add connection columns to dq_sources
-- ============================================================================
-- These columns were in Legacy but incorrectly dropped during simplification.
-- Now adding back with Fabric-friendly modifications (Key Vault instead of env vars).
-- ============================================================================

PRINT 'Starting migration: Add connection columns to dq_sources';
GO

-- Add source_type (was connection_type in Legacy)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' AND COLUMN_NAME = 'source_type')
BEGIN
    ALTER TABLE dbo.dq_sources ADD source_type NVARCHAR(50) NULL;
    PRINT 'Added column: source_type';
END
GO

-- Add server_name (was in Legacy, dropped)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' AND COLUMN_NAME = 'server_name')
BEGIN
    ALTER TABLE dbo.dq_sources ADD server_name NVARCHAR(255) NULL;
    PRINT 'Added column: server_name';
END
GO

-- Add database_name (was in Legacy, dropped)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' AND COLUMN_NAME = 'database_name')
BEGIN
    ALTER TABLE dbo.dq_sources ADD database_name NVARCHAR(255) NULL;
    PRINT 'Added column: database_name';
END
GO

-- Add keyvault_uri (NEW - replaces password_env_var pattern)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' AND COLUMN_NAME = 'keyvault_uri')
BEGIN
    ALTER TABLE dbo.dq_sources ADD keyvault_uri NVARCHAR(255) NULL;
    PRINT 'Added column: keyvault_uri';
END
GO

-- Add client_id (NEW - for per-source Service Principal)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' AND COLUMN_NAME = 'client_id')
BEGIN
    ALTER TABLE dbo.dq_sources ADD client_id NVARCHAR(100) NULL;
    PRINT 'Added column: client_id';
END
GO

-- Add secret_name (NEW - Key Vault secret reference, replaces password_env_var)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' AND COLUMN_NAME = 'secret_name')
BEGIN
    ALTER TABLE dbo.dq_sources ADD secret_name NVARCHAR(100) NULL;
    PRINT 'Added column: secret_name';
END
GO

PRINT 'Migration complete: dq_sources connection columns added';
GO
