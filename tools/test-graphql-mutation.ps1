# Test GraphQL Mutations (INSERT/UPDATE/DELETE)
param()

# Load credentials
$envPath = Join-Path $PSScriptRoot ".." ".env"
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$endpoint = $env:DQ_GRAPHQL_ENDPOINT

Write-Host ""
Write-Host "=== GraphQL Mutation Test ===" -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint" -ForegroundColor Gray
Write-Host ""

# Get token
$tokenUrl = "https://login.microsoftonline.com/$env:AZURE_TENANT_ID/oauth2/v2.0/token"
$body = @{
    client_id     = $env:AZURE_CLIENT_ID
    client_secret = $env:AZURE_CLIENT_SECRET
    scope         = "https://analysis.windows.net/powerbi/api/.default"
    grant_type    = "client_credentials"
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
    $token = $tokenResponse.access_token
    Write-Host "Token acquired" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to acquire token: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

# Test 1: Try INSERT mutation on dq_sources
Write-Host ""
Write-Host "=== Test 1: INSERT into dq_sources ===" -ForegroundColor Yellow

$insertMutation = @"
{
  "query": "mutation { createDq_sources(item: { source_name: \"Test Source\", description: \"Created via GraphQL\", is_active: true }) { result { source_id source_name } } }"
}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $insertMutation
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Yellow }
    } else {
        Write-Host "SUCCESS: Created source" -ForegroundColor Green
        $resp.data | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Test 2: Try alternative mutation syntax (insert_)
Write-Host ""
Write-Host "=== Test 2: Alternative INSERT syntax ===" -ForegroundColor Yellow

$insertMutation2 = @"
{
  "query": "mutation { insert_dq_sources(objects: [{ source_name: \"Test Source 2\", description: \"Alt syntax\", is_active: true }]) { returning { source_id } } }"
}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $insertMutation2
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Yellow }
    } else {
        Write-Host "SUCCESS" -ForegroundColor Green
        $resp.data | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Test 3: Check what mutations are available
Write-Host ""
Write-Host "=== Test 3: List available mutations ===" -ForegroundColor Yellow

$mutationQuery = @"
{
  "query": "{ __schema { mutationType { fields { name } } } }"
}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $mutationQuery
    if ($resp.errors) {
        Write-Host "Introspection blocked or error:" -ForegroundColor Yellow
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Yellow }
    } else {
        Write-Host "Available mutations:" -ForegroundColor Green
        $resp.data.__schema.mutationType.fields | ForEach-Object { Write-Host "  - $($_.name)" }
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Test 4: Try executeXxx pattern (stored procedure)
Write-Host ""
Write-Host "=== Test 4: Execute stored procedure ===" -ForegroundColor Yellow

$spMutation = @"
{
  "query": "mutation { executesp_create_data_source(source_name: \"SP Test\", description: \"Via SP\", is_active: true) { source_id } }"
}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $spMutation
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Yellow }
    } else {
        Write-Host "SUCCESS" -ForegroundColor Green
        $resp.data | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Mutation Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: If mutations are not available, you may need to:" -ForegroundColor Yellow
Write-Host "  1. Enable mutations in the GraphQL API settings in Fabric Portal" -ForegroundColor Gray
Write-Host "  2. Add stored procedures to the GraphQL schema" -ForegroundColor Gray
Write-Host "  3. Ensure tables have primary keys defined" -ForegroundColor Gray
