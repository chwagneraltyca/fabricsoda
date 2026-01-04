# Check data in existing tables
$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Checking data counts..." -ForegroundColor Cyan

$query = @"
SELECT 'dq_sources' AS tbl, COUNT(*) AS cnt FROM dbo.dq_sources UNION ALL
SELECT 'dq_testcases', COUNT(*) FROM dbo.dq_testcases UNION ALL
SELECT 'dq_checks', COUNT(*) FROM dbo.dq_checks UNION ALL
SELECT 'dq_checks_freshness', COUNT(*) FROM dbo.dq_checks_freshness UNION ALL
SELECT 'dq_checks_schema', COUNT(*) FROM dbo.dq_checks_schema UNION ALL
SELECT 'dq_checks_reference', COUNT(*) FROM dbo.dq_checks_reference UNION ALL
SELECT 'dq_checks_scalar', COUNT(*) FROM dbo.dq_checks_scalar UNION ALL
SELECT 'dq_checks_custom', COUNT(*) FROM dbo.dq_checks_custom UNION ALL
SELECT 'fabric_metadata', COUNT(*) FROM dbo.fabric_metadata
"@

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $env:AZURE_CLIENT_ID `
    -P $env:AZURE_CLIENT_SECRET `
    -Q $query
