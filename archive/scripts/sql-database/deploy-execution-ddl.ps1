# Deploy notebook-execution-ddl.sql to Fabric SQL Database
$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Deploying to: $env:DQ_SQL_SERVER / $env:DQ_SQL_DATABASE" -ForegroundColor Cyan

$sqlFile = Join-Path $PSScriptRoot "../../setup/notebook-execution-ddl.sql"

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $env:AZURE_CLIENT_ID `
    -P $env:AZURE_CLIENT_SECRET `
    -i $sqlFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "Deployment failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
