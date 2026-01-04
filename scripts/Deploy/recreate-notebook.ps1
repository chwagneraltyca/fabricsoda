# Delete and recreate notebook in Fabric
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
$workspaceId = $env:DQ_WORKSPACE_ID
$notebookId = "9cb8be11-6621-48d0-9dbf-0b37a69d923a"

Write-Host "Recreating notebook..." -ForegroundColor Cyan

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

# Delete existing notebook
Write-Host "Deleting existing notebook..." -ForegroundColor Yellow
$deleteUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId"
try {
    Invoke-RestMethod -Method Delete -Uri $deleteUrl -Headers $headers
    Write-Host "  Deleted!" -ForegroundColor Green
    Start-Sleep -Seconds 5  # Wait for deletion to propagate
} catch {
    Write-Host "  Delete failed (may not exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Read notebook content
$notebookPath = Join-Path $PSScriptRoot "../../src/Notebook/dq_checker_scan.ipynb"
$notebookContent = Get-Content $notebookPath -Raw -Encoding UTF8

# Base64 encode
$notebookBytes = [System.Text.Encoding]::UTF8.GetBytes($notebookContent)
$notebookBase64 = [Convert]::ToBase64String($notebookBytes)

# Create new notebook
Write-Host "Creating new notebook..." -ForegroundColor Gray
$createUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items"

$createBody = @{
    displayName = "dq_checker_scan"
    type = "Notebook"
    definition = @{
        format = "ipynb"
        parts = @(
            @{
                path = "notebook-content.ipynb"
                payload = $notebookBase64
                payloadType = "InlineBase64"
            }
        )
    }
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Method Post -Uri $createUrl -Headers $headers -Body $createBody
Write-Host "Created! ID: $($response.id)" -ForegroundColor Green

# Update script with new ID
$response.id
