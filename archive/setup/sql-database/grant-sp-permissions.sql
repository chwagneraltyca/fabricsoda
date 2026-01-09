-- ============================================================================
-- Grant Service Principal permissions for DQ Checker notebook
-- ============================================================================
-- SP: b9450ac1-a673-4e67-87de-1b3b94036a40
-- Permissions needed: SELECT (read checks), EXECUTE (call SPs)
-- ============================================================================

-- Create user for the Service Principal (if not exists)
-- Note: In Fabric SQL DB, use the Application (client) ID
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'b9450ac1-a673-4e67-87de-1b3b94036a40')
BEGIN
    CREATE USER [b9450ac1-a673-4e67-87de-1b3b94036a40] FROM EXTERNAL PROVIDER;
    PRINT 'Created user for Service Principal';
END
ELSE
BEGIN
    PRINT 'User for Service Principal already exists';
END
GO

-- Grant db_datareader role (SELECT on all tables/views)
ALTER ROLE db_datareader ADD MEMBER [b9450ac1-a673-4e67-87de-1b3b94036a40];
PRINT 'Granted db_datareader role';
GO

-- Grant db_datawriter role (INSERT, UPDATE, DELETE on all tables)
ALTER ROLE db_datawriter ADD MEMBER [b9450ac1-a673-4e67-87de-1b3b94036a40];
PRINT 'Granted db_datawriter role';
GO

-- Grant EXECUTE on all stored procedures in dbo schema
GRANT EXECUTE ON SCHEMA::dbo TO [b9450ac1-a673-4e67-87de-1b3b94036a40];
PRINT 'Granted EXECUTE on dbo schema';
GO

-- Verify permissions
SELECT
    dp.name AS principal_name,
    dp.type_desc AS principal_type,
    o.name AS object_name,
    p.permission_name,
    p.state_desc
FROM sys.database_permissions p
JOIN sys.database_principals dp ON p.grantee_principal_id = dp.principal_id
LEFT JOIN sys.objects o ON p.major_id = o.object_id
WHERE dp.name = 'b9450ac1-a673-4e67-87de-1b3b94036a40';
GO

PRINT '';
PRINT 'Service Principal permissions configured successfully!';
PRINT 'SP can now: SELECT, INSERT, UPDATE, DELETE, EXECUTE on dbo schema';
GO
