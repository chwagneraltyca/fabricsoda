# Upload notebook using Fabric REST API
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

Write-Host "Uploading notebook via REST API..." -ForegroundColor Cyan
Write-Host "  Workspace ID: $workspaceId" -ForegroundColor Gray

# Get access token
$tokenUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token"
$body = @{
    client_id     = $clientId
    client_secret = $clientSecret
    scope         = "https://api.fabric.microsoft.com/.default"
    grant_type    = "client_credentials"
}

Write-Host "Getting access token..." -ForegroundColor Gray
$tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType "application/x-www-form-urlencoded"
$accessToken = $tokenResponse.access_token
Write-Host "  Token acquired" -ForegroundColor Green

# Read notebook content
$notebookPath = Join-Path $PSScriptRoot "../../src/Notebook/dq_checker_scan.ipynb"
$notebookContent = Get-Content $notebookPath -Raw -Encoding UTF8

# Base64 encode
$notebookBytes = [System.Text.Encoding]::UTF8.GetBytes($notebookContent)
$notebookBase64 = [Convert]::ToBase64String($notebookBytes)

# Create notebook item
$apiUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items"

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# First try to find existing notebook
Write-Host "Checking for existing notebook..." -ForegroundColor Gray
$listUrl = "$apiUrl"
$items = Invoke-RestMethod -Method Get -Uri $listUrl -Headers $headers

$existingNotebook = $items.value | Where-Object { $_.displayName -eq "dq_checker_scan" -and $_.type -eq "Notebook" }

if ($existingNotebook) {
    Write-Host "  Notebook exists (ID: $($existingNotebook.id)), updating..." -ForegroundColor Yellow

    # Update notebook definition
    $updateUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$($existingNotebook.id)/updateDefinition"

    $updateBody = @{
        definition = @{
            parts = @(
                @{
                    path = "notebook-content.ipynb"
                    payload = $notebookBase64
                    payloadType = "InlineBase64"
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Method Post -Uri $updateUrl -Headers $headers -Body $updateBody
        Write-Host "Notebook updated successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Update failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Yellow
        }
        exit 1
    }
} else {
    Write-Host "  Creating new notebook..." -ForegroundColor Gray

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

    try {
        $response = Invoke-RestMethod -Method Post -Uri $apiUrl -Headers $headers -Body $createBody
        Write-Host "Notebook created successfully!" -ForegroundColor Green
        Write-Host "  ID: $($response.id)" -ForegroundColor Gray
    } catch {
        Write-Host "Creation failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Yellow
        }
        exit 1
    }
}
