# Get notebook definition - raw response
param(
    [string]$NotebookId = "25c0b401-9fc9-46aa-9911-509440c23bf4"
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
$workspaceId = $env:DQ_WORKSPACE_ID

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
}

# Get definition - use WebRequest to see full response
$defUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$NotebookId/getDefinition?format=ipynb"

Write-Host "URL: $defUrl"

$response = Invoke-WebRequest -Method Post -Uri $defUrl -Headers $headers

Write-Host "Status: $($response.StatusCode)"
Write-Host "Headers:"
$response.Headers.Keys | ForEach-Object { Write-Host "  $_`: $($response.Headers[$_])" }

if ($response.StatusCode -eq 202) {
    # Async - need to poll
    $location = $response.Headers["Location"]
    if ($location -is [array]) { $location = $location[0] }
    Write-Host "`nAsync operation, polling: $location"

    # Poll until complete
    do {
        Start-Sleep -Seconds 5
        $opStatus = Invoke-RestMethod -Method Get -Uri $location -Headers $headers
        Write-Host "Status: $($opStatus.status)"
    } while ($opStatus.status -eq "Running")

    # Get the result
    $resultUrl = "$location/result"
    Write-Host "Getting result from: $resultUrl"
    $result = Invoke-RestMethod -Method Get -Uri $resultUrl -Headers $headers
    Write-Host ($result | ConvertTo-Json -Depth 10)

    if ($result.definition -and $result.definition.parts) {
        $payload = $result.definition.parts[0].payload
        $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))
        $notebook = $decoded | ConvertFrom-Json
        Write-Host "`n=== METADATA ===" -ForegroundColor Yellow
        Write-Host ($notebook.metadata | ConvertTo-Json -Depth 10)
    }
} else {
    Write-Host "Body: $($response.Content)"
}
