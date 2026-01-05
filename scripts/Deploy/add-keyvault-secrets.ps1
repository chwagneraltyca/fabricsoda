# Add required secrets to Azure Key Vault for DQ Checker
$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$vaultName = "chwakv"

Write-Host "Adding secrets to Key Vault: $vaultName" -ForegroundColor Cyan

# Login to Azure (uses Service Principal from environment)
Write-Host "`nLogging in to Azure..." -ForegroundColor Gray
az login --service-principal -u $env:AZURE_CLIENT_ID -p $env:AZURE_CLIENT_SECRET --tenant $env:AZURE_TENANT_ID --output none

# Add secrets
$secrets = @{
    "dq-checker-spn-client-id" = $env:AZURE_CLIENT_ID
    "dq-checker-meta-db-server" = "yndfhalt62tejhuwlqaqhskcgu-n3hvjhr6avluxog2ch3jdnb5ya.database.fabric.microsoft.com"
    "dq-checker-meta-db-name" = "soda_db-3dbb8254-b235-48a7-b66b-6b321f471b52"
}

foreach ($name in $secrets.Keys) {
    Write-Host "  Setting: $name" -ForegroundColor Gray
    az keyvault secret set --vault-name $vaultName --name $name --value $secrets[$name] --output none
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    OK" -ForegroundColor Green
    } else {
        Write-Host "    FAILED" -ForegroundColor Red
    }
}

Write-Host "`nSecrets added successfully!" -ForegroundColor Green
Write-Host "Existing secret 'dq-checker-spn-secret' should already contain the client secret."
