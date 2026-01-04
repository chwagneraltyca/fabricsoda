# Test connection to DQ Checker metadata SQL database
param(
    [string]$Server = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.database.fabric.microsoft.com,1433",
    [string]$Database = "soda_db-3dbb8254-b235-48a7-b66b-6b321f471b52"
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
Write-Host "DQ Checker Metadata Database Connection" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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
        Write-Host "SUCCESS! Connected to metadata database:" -ForegroundColor Green
        Write-Host $result

        Write-Host ""
        Write-Host "Checking existing schemas..." -ForegroundColor Yellow
        $schemas = sqlcmd -S $Server -d $Database `
            --authentication-method ActiveDirectoryServicePrincipal `
            -U $env:AZURE_CLIENT_ID `
            -P $env:AZURE_CLIENT_SECRET `
            -Q "SELECT name FROM sys.schemas WHERE name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest') ORDER BY name" `
            -h -1 -W

        if ($schemas) {
            Write-Host "Existing schemas:" -ForegroundColor Cyan
            Write-Host $schemas
        } else {
            Write-Host "No custom schemas found (only system schemas)" -ForegroundColor Yellow
        }

        Write-Host ""
        Write-Host "Checking existing tables..." -ForegroundColor Yellow
        $tables = sqlcmd -S $Server -d $Database `
            --authentication-method ActiveDirectoryServicePrincipal `
            -U $env:AZURE_CLIENT_ID `
            -P $env:AZURE_CLIENT_SECRET `
            -Q "SELECT TABLE_SCHEMA + '.' + TABLE_NAME AS TableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME" `
            -h -1 -W

        if ($tables) {
            Write-Host "Existing tables:" -ForegroundColor Cyan
            Write-Host $tables
        } else {
            Write-Host "No tables found - database is empty (ready for schema deployment)" -ForegroundColor Green
        }

    } else {
        Write-Host "Connection failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host $result
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
