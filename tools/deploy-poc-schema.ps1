# Deploy POC schema to DQ Checker metadata database
param(
    [switch]$DryRun
)

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
Write-Host "DQ Checker POC Schema Deployment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  Server:   $server"
Write-Host "  Database: $database"
Write-Host ""

$schemaFile = Join-Path $PSScriptRoot ".." "setup" "poc-schema-ddl.sql"

if (-not (Test-Path $schemaFile)) {
    Write-Host "ERROR: Schema file not found at $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host "Schema file: $schemaFile" -ForegroundColor Yellow

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN - Would execute schema from:" -ForegroundColor Yellow
    Write-Host $schemaFile
    Write-Host ""
    Write-Host "Schema contents (first 50 lines):" -ForegroundColor Cyan
    Get-Content $schemaFile | Select-Object -First 50
    exit 0
}

Write-Host ""
Write-Host "Deploying schema..." -ForegroundColor Yellow

# Execute schema DDL
sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId `
    -P $clientSecret `
    -i $schemaFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Schema deployed successfully!" -ForegroundColor Green
    Write-Host ""

    # Verify deployment
    Write-Host "Verifying deployment..." -ForegroundColor Yellow

    $verifyQuery = @"
SELECT 'Tables' AS ObjectType, COUNT(*) AS Count
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'dq_%' AND TABLE_TYPE = 'BASE TABLE'
UNION ALL
SELECT 'Views', COUNT(*)
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'vw_%'
UNION ALL
SELECT 'Procedures', COUNT(*)
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_SCHEMA = 'dbo' AND ROUTINE_NAME LIKE 'sp_%' AND ROUTINE_TYPE = 'PROCEDURE';
"@

    sqlcmd -S $server -d $database `
        --authentication-method ActiveDirectoryServicePrincipal `
        -U $clientId `
        -P $clientSecret `
        -Q $verifyQuery

    Write-Host ""
    Write-Host "Listing DQ tables:" -ForegroundColor Cyan
    sqlcmd -S $server -d $database `
        --authentication-method ActiveDirectoryServicePrincipal `
        -U $clientId `
        -P $clientSecret `
        -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'dq_%' ORDER BY TABLE_NAME" `
        -h -1 -W

    Write-Host ""
    Write-Host "Listing views:" -ForegroundColor Cyan
    sqlcmd -S $server -d $database `
        --authentication-method ActiveDirectoryServicePrincipal `
        -U $clientId `
        -P $clientSecret `
        -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME LIKE 'vw_%' ORDER BY TABLE_NAME" `
        -h -1 -W

    Write-Host ""
    Write-Host "Listing stored procedures:" -ForegroundColor Cyan
    sqlcmd -S $server -d $database `
        --authentication-method ActiveDirectoryServicePrincipal `
        -U $clientId `
        -P $clientSecret `
        -Q "SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = 'dbo' AND ROUTINE_NAME LIKE 'sp_%' AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME" `
        -h -1 -W

} else {
    Write-Host ""
    Write-Host "Schema deployment FAILED with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
