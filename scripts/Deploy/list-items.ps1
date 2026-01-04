# List items in Fabric workspace
$ErrorActionPreference = "Stop"

# Load environment
$envPath = Join-Path $PSScriptRoot ".." ".." ".env"
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$workspaceId = $env:DQ_WORKSPACE_ID
$tenantId = $env:AZURE_TENANT_ID
$clientId = $env:AZURE_CLIENT_ID
$clientSecret = $env:AZURE_CLIENT_SECRET

Write-Host "=== Listing Workspace Items ===" -ForegroundColor Cyan
Write-Host "Workspace: $workspaceId"

# Get token
$body = @{
    grant_type = "client_credentials"
    client_id = $clientId
    client_secret = $clientSecret
    scope = "https://api.fabric.microsoft.com/.default"
}
$tokenResponse = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" -Method Post -Body $body
$token = $tokenResponse.access_token

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# List all items
$listUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items"
$items = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get

Write-Host "`nItems in workspace:"
$items.value | ForEach-Object {
    Write-Host "  $($_.type): $($_.displayName) (ID: $($_.id))"
}

# Filter SQL databases
Write-Host "`nSQL Databases:"
$items.value | Where-Object { $_.type -eq "SQLDatabase" } | ForEach-Object {
    Write-Host "  $($_.displayName) (ID: $($_.id))" -ForegroundColor Yellow
}

# Filter Warehouses
Write-Host "`nWarehouses:"
$items.value | Where-Object { $_.type -eq "Warehouse" } | ForEach-Object {
    Write-Host "  $($_.displayName) (ID: $($_.id))" -ForegroundColor Yellow
}

# Filter Lakehouses
Write-Host "`nLakehouses:"
$items.value | Where-Object { $_.type -eq "Lakehouse" } | ForEach-Object {
    Write-Host "  $($_.displayName) (ID: $($_.id))" -ForegroundColor Yellow
}
