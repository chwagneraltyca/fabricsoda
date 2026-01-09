# Run database migration
param(
    [string]$MigrationFile = "setup/migrations/001-add-source-connection-columns.sql"
)

$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Running migration: $MigrationFile" -ForegroundColor Cyan
Write-Host "  Server: $env:DQ_SQL_SERVER"
Write-Host "  Database: $env:DQ_SQL_DATABASE"

$migrationPath = Join-Path $PSScriptRoot "../../$MigrationFile"

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $env:AZURE_CLIENT_ID `
    -P $env:AZURE_CLIENT_SECRET `
    -i $migrationPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMigration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nMigration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
