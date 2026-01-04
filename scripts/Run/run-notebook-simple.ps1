# Run DQ Checker notebook via Fabric REST API (simple, no parameters)
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
$notebookId = "b887e193-bd98-4389-896b-1a4f73316e3d"

Write-Host "=== Running DQ Checker Notebook ===" -ForegroundColor Cyan
Write-Host "  Workspace: $workspaceId" -ForegroundColor Gray
Write-Host "  Notebook: $notebookId" -ForegroundColor Gray

# Get access token
$tokenUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token"
$body = @{
    client_id     = $clientId
    client_secret = $clientSecret
    scope         = "https://api.fabric.microsoft.com/.default"
    grant_type    = "client_credentials"
}

Write-Host "`nGetting access token..." -ForegroundColor Gray
$tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType "application/x-www-form-urlencoded"
$accessToken = $tokenResponse.access_token
Write-Host "  Token acquired" -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

# Run notebook - simple run without parameters
$runUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$notebookId/jobs/instances?jobType=RunNotebook"

Write-Host "`nTriggering notebook execution..." -ForegroundColor Gray

try {
    # Enable %pip install for API runs
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

    $response = Invoke-WebRequest -Method Post -Uri $runUrl -Headers $headers -Body $runBody

    Write-Host "  Notebook execution triggered!" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor Gray

    # Get job instance ID from location header
    $locationHeader = $response.Headers["Location"]
    if ($locationHeader -is [array]) {
        $locationHeader = $locationHeader[0]
    }
    if ($locationHeader) {
        Write-Host "  Job Instance URL: $locationHeader" -ForegroundColor Gray

        # Poll for status
        Write-Host "`nMonitoring job status..." -ForegroundColor Cyan
        $maxAttempts = 60  # 10 minutes max
        $attempt = 0

        do {
            Start-Sleep -Seconds 10
            $attempt++

            $statusResponse = Invoke-RestMethod -Method Get -Uri $locationHeader -Headers $headers
            $status = $statusResponse.status

            $color = switch ($status) {
                "InProgress" { "Yellow" }
                "Completed" { "Green" }
                "Failed" { "Red" }
                default { "White" }
            }

            Write-Host "  [$attempt] Status: $status" -ForegroundColor $color

            if ($status -eq "Completed") {
                Write-Host "`n=== Notebook Execution Completed ===" -ForegroundColor Green
                break
            } elseif ($status -eq "Failed") {
                Write-Host "`n=== Notebook Execution Failed ===" -ForegroundColor Red
                Write-Host ($statusResponse | ConvertTo-Json -Depth 5) -ForegroundColor Red
                exit 1
            }

        } while ($attempt -lt $maxAttempts)

        if ($attempt -ge $maxAttempts) {
            Write-Host "`nTimeout waiting for notebook completion" -ForegroundColor Yellow
        }
    }

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
    exit 1
}
