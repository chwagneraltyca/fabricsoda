# Check database permissions for the metadata database
$ErrorActionPreference = "Stop"

# Load .env
$envPath = Join-Path $PSScriptRoot ".." ".." ".env"
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Checking database permissions..." -ForegroundColor Cyan
Write-Host "  Server:   $env:DQ_SQL_SERVER"
Write-Host "  Database: $env:DQ_SQL_DATABASE"
Write-Host ""

# Get token via Service Principal
Write-Host "Getting access token via Service Principal..." -ForegroundColor Gray
$body = @{
    grant_type    = "client_credentials"
    client_id     = $env:AZURE_CLIENT_ID
    client_secret = $env:AZURE_CLIENT_SECRET
    scope         = "https://database.windows.net/.default"
}
$tokenUrl = "https://login.microsoftonline.com/$env:AZURE_TENANT_ID/oauth2/v2.0/token"
$tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method POST -Body $body
$token = $tokenResponse.access_token

# Query 1: List database principals
Write-Host "`n=== Database Principals ===" -ForegroundColor Yellow
$query1 = @"
SELECT name, type_desc, authentication_type_desc
FROM sys.database_principals
WHERE type IN ('S', 'U', 'E', 'X')
  AND name NOT IN ('public', 'sys', 'INFORMATION_SCHEMA', 'guest', 'dbo');
"@
sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE -G -P $token -Q $query1

# Query 2: List database role members
Write-Host "`n=== Role Memberships ===" -ForegroundColor Yellow
$query2 = @"
SELECT
    dp.name AS member_name,
    dp.type_desc AS member_type,
    r.name AS role_name
FROM sys.database_role_members drm
JOIN sys.database_principals dp ON drm.member_principal_id = dp.principal_id
JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
WHERE dp.name NOT IN ('dbo');
"@
sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE -G -P $token -Q $query2

# Query 3: Explicit permissions
Write-Host "`n=== Explicit Permissions ===" -ForegroundColor Yellow
$query3 = @"
SELECT
    dp.name AS principal_name,
    perm.permission_name,
    perm.state_desc,
    CASE
        WHEN perm.class = 0 THEN 'DATABASE'
        WHEN perm.class = 1 THEN OBJECT_NAME(perm.major_id)
        WHEN perm.class = 3 THEN SCHEMA_NAME(perm.major_id)
        ELSE 'OTHER'
    END AS object_name
FROM sys.database_permissions perm
JOIN sys.database_principals dp ON perm.grantee_principal_id = dp.principal_id
WHERE dp.name NOT IN ('public', 'sys', 'INFORMATION_SCHEMA', 'guest', 'dbo')
ORDER BY dp.name, perm.permission_name;
"@
sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE -G -P $token -Q $query3

# Query 4: Check stored procedure execute permissions
Write-Host "`n=== SP Execute Permissions ===" -ForegroundColor Yellow
$query4 = @"
SELECT
    dp.name AS principal_name,
    OBJECT_SCHEMA_NAME(perm.major_id) + '.' + OBJECT_NAME(perm.major_id) AS procedure_name,
    perm.permission_name,
    perm.state_desc
FROM sys.database_permissions perm
JOIN sys.database_principals dp ON perm.grantee_principal_id = dp.principal_id
JOIN sys.objects o ON perm.major_id = o.object_id
WHERE o.type = 'P'
  AND dp.name NOT IN ('public', 'sys', 'INFORMATION_SCHEMA', 'guest', 'dbo');
"@
sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE -G -P $token -Q $query4
