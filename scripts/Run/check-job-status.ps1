# Check notebook job status
param(
    [string]$JobInstanceUrl = "https://api.fabric.microsoft.com/v1/workspaces/9e54cf6e-053e-4b57-b8da-11f691b43dc0/items/9cb8be11-6621-48d0-9dbf-0b37a69d923a/jobs/instances/d4a8ee4a-f354-4469-90e9-4a19e52459ba"
)

$ErrorActionPreference = "Stop"

# Load environment
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$tenantId = $env:AZURE_TENANT_ID
$clientId = $env:AZURE_CLIENT_ID
$clientSecret = $env:AZURE_CLIENT_SECRET

# Get access token
$tokenUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token"
$body = @{
    client_id     = $clientId
    client_secret = $clientSecret
    scope         = "https://api.fabric.microsoft.com/.default"
    grant_type    = "client_credentials"
}

$tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType "application/x-www-form-urlencoded"
$accessToken = $tokenResponse.access_token

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

Write-Host "Checking job status..." -ForegroundColor Cyan

$statusResponse = Invoke-RestMethod -Method Get -Uri $JobInstanceUrl -Headers $headers
Write-Host ($statusResponse | ConvertTo-Json -Depth 5)
