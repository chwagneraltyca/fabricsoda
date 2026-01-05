# Fabric Notebook Sync - Download/Upload via REST API
# Usage:
#   pwsh sync-notebook.ps1 download    # Download notebook from Fabric
#   pwsh sync-notebook.ps1 upload      # Upload notebook to Fabric

param(
    [Parameter(Position=0)]
    [ValidateSet("download", "upload")]
    [string]$Action = "download"
)

$ErrorActionPreference = "Stop"

# Load .env
$envPath = Join-Path $PSScriptRoot ".." ".." ".env"
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

# Configuration
$workspaceId = $env:DQ_WORKSPACE_ID
$notebookName = "dq_checker_scan"
$localPath = Join-Path $PSScriptRoot ".." ".." "src" "Notebook" "dq_checker_scan.ipynb"

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

# Find notebook ID
Write-Host "Finding notebook: $notebookName" -ForegroundColor Cyan
$listUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items?type=Notebook"
$items = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get
$notebook = $items.value | Where-Object { $_.displayName -eq $notebookName }

if (-not $notebook) {
    Write-Host "ERROR: Notebook '$notebookName' not found!" -ForegroundColor Red
    Write-Host "Available notebooks:"
    $items.value | ForEach-Object { Write-Host "  $($_.displayName)" }
    exit 1
}

$notebookId = $notebook.id
Write-Host "  Notebook ID: $notebookId" -ForegroundColor Gray

if ($Action -eq "download") {
    Write-Host "Downloading notebook from Fabric..." -ForegroundColor Cyan

    # Get notebook definition (may return 202 for async)
    $url = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId/getDefinition?format=ipynb"

    try {
        # Use WebRequest to handle 202 responses
        $webResponse = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -UseBasicParsing

        if ($webResponse.StatusCode -eq 202) {
            # Async response - poll until complete
            $location = $webResponse.Headers["Location"]
            if ($location -is [array]) { $location = $location[0] }
            Write-Host "Async response, polling..." -ForegroundColor Yellow

            do {
                Start-Sleep -Seconds 2
                $pollResponse = Invoke-RestMethod -Uri $location -Method GET -Headers $headers
                Write-Host "Status: $($pollResponse.status)" -ForegroundColor Gray
            } while ($pollResponse.status -eq "Running")

            if ($pollResponse.status -eq "Succeeded") {
                $response = @{ definition = @{ parts = @() } }
                if ($pollResponse.PSObject.Properties["definition"]) {
                    $response = $pollResponse
                } else {
                    $resultUrl = $location + "/result"
                    $response = Invoke-RestMethod -Uri $resultUrl -Method GET -Headers $headers
                }
            } else {
                throw "Operation failed: $($pollResponse.status)"
            }
        } else {
            $response = $webResponse.Content | ConvertFrom-Json
        }

        # Extract the notebook content
        $notebookPart = $response.definition.parts | Where-Object { $_.path -eq "notebook-content.ipynb" }
        if ($notebookPart) {
            $content = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($notebookPart.payload))
            $content | Out-File -FilePath $localPath -Encoding UTF8 -NoNewline
            Write-Host "Downloaded to: $localPath" -ForegroundColor Green
        } else {
            Write-Host "No notebook content found." -ForegroundColor Red
            $response | ConvertTo-Json -Depth 5
        }
    } catch {
        Write-Host "Download failed: $_" -ForegroundColor Red
        if ($_.ErrorDetails) { $_.ErrorDetails.Message }
    }
}
elseif ($Action -eq "upload") {
    Write-Host "Uploading notebook to Fabric..." -ForegroundColor Cyan

    if (-not (Test-Path $localPath)) {
        Write-Host "File not found: $localPath" -ForegroundColor Red
        exit 1
    }

    # Read notebook and fix source format if needed
    # (Some tools create string sources, but Fabric requires arrays)
    $nb = Get-Content -Path $localPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $fixed = $false
    for ($i = 0; $i -lt $nb.cells.Count; $i++) {
        if ($nb.cells[$i].source -is [string]) {
            $lines = $nb.cells[$i].source -split '(?<=\n)'
            $nb.cells[$i].source = @($lines)
            $fixed = $true
        }
    }
    if ($fixed) {
        Write-Host "Fixed cell source format (string -> array)" -ForegroundColor Yellow
    }
    $content = $nb | ConvertTo-Json -Depth 20
    $base64Content = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))

    # Build update payload
    $payload = @{
        definition = @{
            format = "ipynb"
            parts = @(
                @{
                    path = "notebook-content.ipynb"
                    payload = $base64Content
                    payloadType = "InlineBase64"
                }
            )
        }
    } | ConvertTo-Json -Depth 10

    $url = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId/updateDefinition"

    try {
        $webResponse = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $payload -ContentType "application/json" -UseBasicParsing

        if ($webResponse.StatusCode -eq 202) {
            # Async response - poll until complete
            $location = $webResponse.Headers["Location"]
            if ($location -is [array]) { $location = $location[0] }
            Write-Host "Async response, polling..." -ForegroundColor Yellow

            do {
                Start-Sleep -Seconds 2
                $pollResponse = Invoke-RestMethod -Uri $location -Method GET -Headers $headers
                Write-Host "Status: $($pollResponse.status)" -ForegroundColor Gray
            } while ($pollResponse.status -eq "Running")

            if ($pollResponse.status -eq "Succeeded") {
                Write-Host "Upload successful!" -ForegroundColor Green
            } else {
                Write-Host "Upload failed: $($pollResponse.status)" -ForegroundColor Red
                $pollResponse | ConvertTo-Json -Depth 5
            }
        } else {
            Write-Host "Upload successful!" -ForegroundColor Green
        }
    } catch {
        Write-Host "Upload failed: $_" -ForegroundColor Red
        if ($_.ErrorDetails) { $_.ErrorDetails.Message }
    }
}
