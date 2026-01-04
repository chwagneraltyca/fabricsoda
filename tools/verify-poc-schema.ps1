# Verify POC schema deployment
param()

# Load credentials
$envFile = Join-Path $PSScriptRoot ".." ".env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$server = $env:DQ_SQL_SERVER
$database = $env:DQ_SQL_DATABASE
$clientId = $env:AZURE_CLIENT_ID
$clientSecret = $env:AZURE_CLIENT_SECRET

Write-Host ""
Write-Host "Verifying POC Schema Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if seed data exists
Write-Host "1. Checking dq_sources table:" -ForegroundColor Yellow
sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId `
    -P $clientSecret `
    -Q "SELECT source_id, source_name, description, is_active FROM dbo.dq_sources"

# Test creating a testcase and check
Write-Host ""
Write-Host "2. Testing sp_create_testcase:" -ForegroundColor Yellow
sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId `
    -P $clientSecret `
    -Q "EXEC dbo.sp_create_testcase @testcase_name = 'POC Test', @source_id = 1, @owner = 'claude'"

Write-Host ""
Write-Host "3. Testing sp_create_check (row_count):" -ForegroundColor Yellow
sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId `
    -P $clientSecret `
    -Q "EXEC dbo.sp_create_check @testcase_id = 1, @source_id = 1, @schema_name = 'dbo', @table_name = 'trips', @check_name = 'Trip row count check', @metric = 'row_count', @fail_comparison = '>', @fail_threshold = 0"

Write-Host ""
Write-Host "4. Verifying vw_checks_complete view:" -ForegroundColor Yellow
sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId `
    -P $clientSecret `
    -Q "SELECT check_id, check_name, metric, table_name, testcase_name, source_name FROM dbo.vw_checks_complete"

Write-Host ""
Write-Host "Verification complete!" -ForegroundColor Green
