# Download a working Python notebook to compare metadata
param(
    [string]$NotebookId = "03caad69-a749-4a40-9a76-92c834c88178",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"

# Load .env
$envPath = Join-Path $PSScriptRoot ".." ".." ".env"
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

if (-not $OutputPath) {
    $OutputPath = Join-Path $PSScriptRoot ".." ".." "tmp" "working-python-notebook.ipynb"
}

# Ensure tmp directory exists
$tmpDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $tmpDir)) {
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
}

# Get access token
Write-Host "Getting access token..." -ForegroundColor Cyan
$tokenUrl = "https://login.microsoftonline.com/$env:AZURE_TENANT_ID/oauth2/v2.0/token"
$body = @{
    grant_type    = "client_credentials"
    client_id     = $env:AZURE_CLIENT_ID
    client_secret = $env:AZURE_CLIENT_SECRET
    scope         = "https://api.fabric.microsoft.com/.default"
}
$token = (Invoke-RestMethod -Uri $tokenUrl -Method POST -Body $body).access_token
$headers = @{ "Authorization" = "Bearer $token" }

# Get notebook definition
Write-Host "Downloading notebook: $NotebookId" -ForegroundColor Cyan
$url = "https://api.fabric.microsoft.com/v1/workspaces/$env:DQ_WORKSPACE_ID/items/$NotebookId/getDefinition?format=ipynb"

$response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -UseBasicParsing

if ($response.StatusCode -eq 202) {
    $location = $response.Headers["Location"]
    if ($location -is [array]) { $location = $location[0] }
    Write-Host "Async response, polling..." -ForegroundColor Yellow

    do {
        Start-Sleep -Seconds 2
        $pollResponse = Invoke-RestMethod -Uri $location -Method GET -Headers $headers
        Write-Host "Status: $($pollResponse.status)" -ForegroundColor Gray
    } while ($pollResponse.status -eq "Running")

    if ($pollResponse.status -eq "Succeeded") {
        $resultUrl = $location + "/result"
        $defResponse = Invoke-RestMethod -Uri $resultUrl -Method GET -Headers $headers
    } else {
        throw "Operation failed: $($pollResponse.status)"
    }
} else {
    $defResponse = $response.Content | ConvertFrom-Json
}

# Extract notebook content
$notebookPart = $defResponse.definition.parts | Where-Object { $_.path -eq "notebook-content.ipynb" }
if ($notebookPart) {
    $content = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($notebookPart.payload))
    $content | Out-File $OutputPath -Encoding UTF8 -NoNewline
    Write-Host "Saved to: $OutputPath" -ForegroundColor Green

    # Show metadata
    Write-Host "`nNotebook Metadata:" -ForegroundColor Cyan
    $nb = $content | ConvertFrom-Json
    $nb.metadata | ConvertTo-Json -Depth 5
} else {
    Write-Host "No notebook content found" -ForegroundColor Red
}
