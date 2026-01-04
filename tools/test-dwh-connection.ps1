# Test connection to sample_dwh
param(
    [string]$Server = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.datawarehouse.fabric.microsoft.com",
    [string]$Database = "sample_dwh"
)

# Load .env file
$envPath = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
    Write-Host "Loaded .env file" -ForegroundColor Green
} else {
    Write-Host "No .env file found at $envPath" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Connection Details:" -ForegroundColor Cyan
Write-Host "  Server:    $Server"
Write-Host "  Database:  $Database"
Write-Host "  Client ID: $env:AZURE_CLIENT_ID"
Write-Host "  Tenant ID: $env:AZURE_TENANT_ID"
Write-Host ""

Write-Host "Testing connection..." -ForegroundColor Yellow

try {
    $result = sqlcmd -S $Server -d $Database `
        --authentication-method ActiveDirectoryServicePrincipal `
        -U $env:AZURE_CLIENT_ID `
        -P $env:AZURE_CLIENT_SECRET `
        -Q "SELECT DB_NAME() AS CurrentDB, @@SERVERNAME AS ServerName, SYSTEM_USER AS LoginUser" `
        -h -1 -W

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS! Connected to:" -ForegroundColor Green
        Write-Host $result
    } else {
        Write-Host "Connection failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host $result
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
