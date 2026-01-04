# Delete notebook by ID
param(
    [Parameter(Mandatory=$true)]
    [string]$NotebookId
)

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

# Get token
$body = @{
    grant_type = "client_credentials"
    client_id = $clientId
    client_secret = $clientSecret
    scope = "https://api.fabric.microsoft.com/.default"
}
$tokenResponse = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" -Method Post -Body $body
$token = $tokenResponse.access_token

$headers = @{ "Authorization" = "Bearer $token" }

# Delete notebook
$deleteUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$NotebookId"
Write-Host "Deleting notebook $NotebookId..."
Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete
Write-Host "Deleted!" -ForegroundColor Green
