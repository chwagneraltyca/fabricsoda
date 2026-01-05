-- Grant database permissions for DQ Checker Service Principal
-- Run via: ./scripts/Deploy/run-migration.ps1 -MigrationFile "scripts/Deploy/grant-db-permissions.sql"

-- Note: In Fabric SQL Database, the Service Principal should already have access
-- through workspace permissions. These grants provide explicit database-level permissions.

-- Create user for Service Principal (if not exists)
-- Replace with your Service Principal name/client ID
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'dq-checker-spn')
BEGIN
    CREATE USER [dq-checker-spn] FROM EXTERNAL PROVIDER;
    PRINT 'Created user: dq-checker-spn';
END
ELSE
BEGIN
    PRINT 'User already exists: dq-checker-spn';
END
GO

-- Grant SELECT on all tables and views (read permission)
GRANT SELECT ON SCHEMA::dbo TO [dq-checker-spn];
PRINT 'Granted SELECT on dbo schema';
GO

-- Grant EXECUTE on all stored procedures
GRANT EXECUTE ON SCHEMA::dbo TO [dq-checker-spn];
PRINT 'Granted EXECUTE on dbo schema';
GO

-- Verify permissions
SELECT
    dp.name AS principal_name,
    dp.type_desc,
    perm.permission_name,
    perm.state_desc,
    CASE perm.class
        WHEN 0 THEN 'DATABASE'
        WHEN 3 THEN 'SCHEMA::' + SCHEMA_NAME(perm.major_id)
        ELSE 'OTHER'
    END AS scope
FROM sys.database_permissions perm
JOIN sys.database_principals dp ON perm.grantee_principal_id = dp.principal_id
WHERE dp.name = 'dq-checker-spn';
GO
