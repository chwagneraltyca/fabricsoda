# Check current database schema
$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Checking schema on: $env:DQ_SQL_SERVER / $env:DQ_SQL_DATABASE" -ForegroundColor Cyan

$query = @"
SELECT 'Tables' AS object_type, TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
SELECT 'Views' AS object_type, TABLE_NAME AS name FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME;
SELECT 'Procedures' AS object_type, ROUTINE_NAME AS name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME;
"@

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $env:AZURE_CLIENT_ID `
    -P $env:AZURE_CLIENT_SECRET `
    -Q $query
