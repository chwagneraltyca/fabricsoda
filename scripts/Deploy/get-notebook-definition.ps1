# Get notebook definition from Fabric
param(
    [string]$NotebookId = "25c0b401-9fc9-46aa-9911-509440c23bf4"  # Reference Python notebook
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

Write-Host "Getting notebook definition..." -ForegroundColor Cyan
Write-Host "  Notebook: $NotebookId" -ForegroundColor Gray

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

# Get definition
$defUrl = "https://api.fabric.microsoft.com/v1/workspaces/$workspaceId/items/$NotebookId/getDefinition?format=ipynb"

try {
    $response = Invoke-RestMethod -Method Post -Uri $defUrl -Headers $headers
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 10)

    # Decode base64 payload
    if ($response.definition -and $response.definition.parts) {
        $payload = $response.definition.parts[0].payload
        $decoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))

        # Parse JSON and extract metadata
        $notebook = $decoded | ConvertFrom-Json
        Write-Host "`n=== METADATA ===" -ForegroundColor Yellow
        Write-Host ($notebook.metadata | ConvertTo-Json -Depth 10)
    }

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
}
