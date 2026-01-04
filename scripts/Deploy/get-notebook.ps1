# Get notebook definition from Fabric workspace
param(
    [Parameter(Mandatory=$true)]
    [string]$NotebookName
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

Write-Host "Getting notebook: $NotebookName" -ForegroundColor Cyan

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

# Find notebook
$listUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items?type=Notebook"
$items = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get
$notebook = $items.value | Where-Object { $_.displayName -eq $NotebookName }

if (-not $notebook) {
    Write-Host "ERROR: Notebook '$NotebookName' not found!" -ForegroundColor Red
    Write-Host "Available notebooks:"
    $items.value | ForEach-Object { Write-Host "  $($_.displayName)" }
    exit 1
}

$notebookId = $notebook.id
Write-Host "  Notebook ID: $notebookId"

# Get definition
$defUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId/getDefinition"
$defResponse = Invoke-RestMethod -Uri $defUrl -Headers $headers -Method Post
$definition = $defResponse.definition.parts | Where-Object { $_.path -eq "notebook-content.ipynb" }

if ($definition) {
    $content = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($definition.payload))
    Write-Host "`n=== Notebook Content ===" -ForegroundColor Yellow
    Write-Host $content
} else {
    Write-Host "No notebook-content.ipynb found in definition"
}
