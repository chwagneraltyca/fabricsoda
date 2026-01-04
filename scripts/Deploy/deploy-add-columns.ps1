# Deploy add-missing-columns.sql
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Adding missing columns..." -ForegroundColor Cyan

$sqlFile = Join-Path $PSScriptRoot "../../setup/add-missing-columns.sql"

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $env:AZURE_CLIENT_ID `
    -P $env:AZURE_CLIENT_SECRET `
    -i $sqlFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Columns added successfully!" -ForegroundColor Green
} else {
    Write-Host "Failed with exit code: $LASTEXITCODE" -ForegroundColor Red
}
