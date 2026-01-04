# Debug GraphQL API - test connection and diagnose issues
# Usage: pwsh tools/debug-graphql.ps1 -Endpoint "https://...graphql.fabric.microsoft.com/..."
param(
    [Parameter(Mandatory=$true)]
    [string]$Endpoint
)

# Load credentials
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

Write-Host "`n=== GraphQL Debug Test ===" -ForegroundColor Cyan
Write-Host "Endpoint: $Endpoint" -ForegroundColor Gray

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

# Test 1: Simple introspection - what types are available?
Write-Host "`n=== Test 1: Schema introspection ===" -ForegroundColor Yellow
$introspectionQuery = @"
{"query": "{ __schema { queryType { fields { name } } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -Body $introspectionQuery
    if ($resp.errors) {
        Write-Host "Introspection errors:" -ForegroundColor Red
        $resp.errors | ConvertTo-Json -Depth 3
    } else {
        Write-Host "Available queries:" -ForegroundColor Green
        $resp.data.__schema.queryType.fields | ForEach-Object { Write-Host "  - $($_.name)" }
    }
} catch {
    Write-Host "Introspection failed: $_" -ForegroundColor Red
}

# Test 2: vw_sources - check for active sources
Write-Host "`n=== Test 2: vw_sources ===" -ForegroundColor Yellow
$sourcesQuery = @"
{"query": "{ vw_sources { items { source_id database_name is_active } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -Body $sourcesQuery
    if ($resp.errors) {
        Write-Host "vw_sources errors:" -ForegroundColor Red
        $resp.errors | ConvertTo-Json -Depth 3
    } else {
        $sources = $resp.data.vw_sources.items
        Write-Host "Found $($sources.Count) sources:" -ForegroundColor Green
        foreach ($s in $sources) {
            $active = if ($s.is_active) { "[ACTIVE]" } else { "" }
            Write-Host "  ID=$($s.source_id): $($s.database_name) $active"
        }
        if ($sources.Count -eq 0) {
            Write-Host "  WARNING: No sources found! Run the pipeline first." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "vw_sources failed: $_" -ForegroundColor Red
}

# Test 3: vw_objects - small query first
Write-Host "`n=== Test 3: vw_objects (first 5) ===" -ForegroundColor Yellow
$objectsQuerySmall = @"
{"query": "{ vw_objects(first: 5) { items { object_id schema_name object_name object_type } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -Body $objectsQuerySmall
    if ($resp.errors) {
        Write-Host "vw_objects errors:" -ForegroundColor Red
        $resp.errors | ConvertTo-Json -Depth 3
    } else {
        $objects = $resp.data.vw_objects.items
        Write-Host "Found $($objects.Count) objects (sample):" -ForegroundColor Green
        foreach ($o in $objects) {
            Write-Host "  $($o.object_id): $($o.schema_name).$($o.object_name) [$($o.object_type)]"
        }
        if ($objects.Count -eq 0) {
            Write-Host "  WARNING: No objects found! Check if views are filtered by active source." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "vw_objects failed: $_" -ForegroundColor Red
}

# Test 4: Large query (same as app uses)
Write-Host "`n=== Test 4: vw_objects (first 10000) ===" -ForegroundColor Yellow
$objectsQueryLarge = @"
{"query": "{ vw_objects(first: 10000) { items { source_id object_id schema_name object_name object_type ref_type ref_name } } }"}
"@

try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -Body $objectsQueryLarge
    $sw.Stop()

    if ($resp.errors) {
        Write-Host "vw_objects (10000) errors:" -ForegroundColor Red
        $resp.errors | ConvertTo-Json -Depth 3
    } else {
        $objects = $resp.data.vw_objects.items
        Write-Host "Found $($objects.Count) objects in $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
        if ($objects.Count -eq 0) {
            Write-Host "  WARNING: No objects! Views may be filtering by is_active source." -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "vw_objects (10000) failed: $_" -ForegroundColor Red
    Write-Host "This might be the 500 error you're seeing in the app!" -ForegroundColor Yellow
}

# Test 5: Raw HTTP to see full response
Write-Host "`n=== Test 5: Raw HTTP response (for debugging) ===" -ForegroundColor Yellow
try {
    $rawResp = Invoke-WebRequest -Uri $Endpoint -Method Post -Headers $headers -Body $objectsQuerySmall
    Write-Host "Status: $($rawResp.StatusCode)" -ForegroundColor $(if ($rawResp.StatusCode -eq 200) { "Green" } else { "Red" })
    Write-Host "Content-Type: $($rawResp.Headers['Content-Type'])"
    Write-Host "Body length: $($rawResp.Content.Length) chars"
} catch {
    Write-Host "Raw request failed:" -ForegroundColor Red
    Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "  Message: $($_.Exception.Message)"

    # Try to read error body
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        Write-Host "  Response body: $errorBody"
    } catch { }
}

Write-Host "`n=== Debug Complete ===" -ForegroundColor Cyan
