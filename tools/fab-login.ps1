# Login to Fabric CLI with service principal

# Load .env
Get-Content "$PSScriptRoot\..\.env" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Logging into Fabric CLI with SPN..." -ForegroundColor Cyan
Write-Host "  Tenant: $env:AZURE_TENANT_ID" -ForegroundColor Gray
Write-Host "  Client ID: $env:AZURE_CLIENT_ID" -ForegroundColor Gray

fab auth login -u $env:AZURE_CLIENT_ID -p $env:AZURE_CLIENT_SECRET --tenant $env:AZURE_TENANT_ID
