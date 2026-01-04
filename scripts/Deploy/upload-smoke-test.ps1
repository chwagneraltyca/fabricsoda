# Upload smoke_test notebook to Fabric workspace
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

Write-Host "Uploading smoke_test notebook..." -ForegroundColor Cyan
Write-Host "  Workspace: $workspaceId"

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

# Check if notebook exists
$listUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items?type=Notebook"
$items = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get
$existing = $items.value | Where-Object { $_.displayName -eq "smoke_test" }

# Read notebook content
$notebookPath = Join-Path $PSScriptRoot ".." ".." "src" "Notebook" "smoke_test.ipynb"
$notebookContent = Get-Content $notebookPath -Raw
$notebookBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($notebookContent))

$definition = @{
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
}

if ($existing) {
    Write-Host "  Notebook exists (ID: $($existing.id)), updating..."
    $updateUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$($existing.id)/updateDefinition"
    Invoke-RestMethod -Uri $updateUrl -Headers $headers -Method Post -Body ($definition | ConvertTo-Json -Depth 10)
    Write-Host "  Updated!" -ForegroundColor Green
    $notebookId = $existing.id
} else {
    Write-Host "  Creating new notebook..."

    # First create the item without definition
    $createBody = @{
        displayName = "smoke_test"
        type = "Notebook"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items" -Headers $headers -Method Post -Body $createBody
    $notebookId = $result.id
    Write-Host "  Created item with ID: $notebookId"

    # Then update with definition
    Start-Sleep -Seconds 2
    $updateUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId/updateDefinition"
    Invoke-RestMethod -Uri $updateUrl -Headers $headers -Method Post -Body ($definition | ConvertTo-Json -Depth 10)
    Write-Host "  Definition uploaded!" -ForegroundColor Green
}

Write-Host "`nNotebook ID: $notebookId" -ForegroundColor Yellow
Write-Host "Ready to run!"
