# Run smoke_test notebook in Fabric
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

Write-Host "=== Running Smoke Test Notebook ===" -ForegroundColor Cyan

# Get token
$body = @{
    grant_type = "client_credentials"
    client_id = $clientId
    client_secret = $clientSecret
    scope = "https://api.fabric.microsoft.com/.default"
}
$tokenResponse = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token" -Method Post -Body $body
$token = $tokenResponse.access_token
Write-Host "  Token acquired"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Find notebook
$listUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items?type=Notebook"
$items = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get
$notebook = $items.value | Where-Object { $_.displayName -eq "smoke_test" }

if (-not $notebook) {
    Write-Host "ERROR: smoke_test notebook not found!" -ForegroundColor Red
    exit 1
}

$notebookId = $notebook.id
Write-Host "  Notebook ID: $notebookId"

# Run notebook with pip install enabled
$runUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId/jobs/instances?jobType=RunNotebook"
$runBody = @{
    executionData = @{
        parameters = @{
            "_inlineInstallationEnabled" = @{
                value = $true
                type = "bool"
            }
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "`nTriggering notebook execution..."
$runResponse = Invoke-WebRequest -Uri $runUrl -Headers $headers -Method Post -Body $runBody
$runResult = $runResponse.Headers["Location"][0]  # Get first element if array
Write-Host "  Status: $($runResponse.StatusCode)"
Write-Host "  Job URL: $runResult"

# Monitor job
Write-Host "`nMonitoring job status..."
$maxChecks = 30
$checkInterval = 10

for ($i = 1; $i -le $maxChecks; $i++) {
    Start-Sleep -Seconds $checkInterval
    $statusResponse = Invoke-RestMethod -Uri $runResult -Headers $headers -Method Get
    $status = $statusResponse.status
    Write-Host "  [$i] Status: $status"

    if ($status -eq "Completed") {
        Write-Host "`n=== Notebook Execution Completed ===" -ForegroundColor Green
        Write-Host ($statusResponse | ConvertTo-Json -Depth 5)
        exit 0
    }
    elseif ($status -eq "Failed" -or $status -eq "Cancelled") {
        Write-Host "`n=== Notebook Execution Failed ===" -ForegroundColor Red
        Write-Host ($statusResponse | ConvertTo-Json -Depth 5)
        exit 1
    }
}

Write-Host "Timeout waiting for notebook completion" -ForegroundColor Yellow
