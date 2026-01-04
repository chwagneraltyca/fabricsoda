# Deploy execution schema and grant SP permissions
$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$server = $env:DQ_SQL_SERVER
$database = $env:DQ_SQL_DATABASE
$clientId = $env:AZURE_CLIENT_ID
$clientSecret = $env:AZURE_CLIENT_SECRET

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Deploying to: $server" -ForegroundColor Cyan
Write-Host "Database: $database" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Step 1: Deploy execution schema
Write-Host "`n[1] Deploying execution schema..." -ForegroundColor Yellow
$execDdl = Join-Path $PSScriptRoot "../../setup/notebook-execution-ddl.sql"

$result = sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId -P $clientSecret `
    -i $execDdl `
    -t 60 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Execution schema deployed!" -ForegroundColor Green
} else {
    Write-Host "  Schema deployment output:" -ForegroundColor Yellow
    Write-Host $result
}

# Step 2: Grant SP permissions
Write-Host "`n[2] Granting Service Principal permissions..." -ForegroundColor Yellow
$grantSql = Join-Path $PSScriptRoot "../../setup/grant-sp-permissions.sql"

$result = sqlcmd -S $server -d $database `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $clientId -P $clientSecret `
    -i $grantSql `
    -t 60 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Permissions granted!" -ForegroundColor Green
} else {
    Write-Host "  Permissions output:" -ForegroundColor Yellow
    Write-Host $result
}

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
