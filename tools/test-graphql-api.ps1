# Test DQ Checker GraphQL API
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
Write-Host "=== DQ Checker GraphQL API Test ===" -ForegroundColor Cyan
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

# Test 1: Query dq_sources table
Write-Host ""
Write-Host "=== Test 1: dq_sources ===" -ForegroundColor Yellow
$query = @"
{"query": "{ dq_sources { items { source_id source_name description is_active } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $query
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Red }
    } else {
        $sources = $resp.data.dq_sources.items
        Write-Host "Found $($sources.Count) sources:" -ForegroundColor Green
        foreach ($s in $sources) {
            $active = if ($s.is_active) { "[ACTIVE]" } else { "" }
            Write-Host "  ID=$($s.source_id): $($s.source_name) $active"
        }
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Test 2: Query vw_checks_complete view
Write-Host ""
Write-Host "=== Test 2: vw_checks_complete ===" -ForegroundColor Yellow
$query = @"
{"query": "{ vw_checks_complete { items { check_id check_name metric table_name testcase_name source_name } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $query
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Red }
    } else {
        $checks = $resp.data.vw_checks_complete.items
        Write-Host "Found $($checks.Count) checks:" -ForegroundColor Green
        foreach ($c in $checks) {
            Write-Host "  ID=$($c.check_id): $($c.check_name) [$($c.metric)] on $($c.table_name)"
        }
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Test 3: Query dq_testcases table
Write-Host ""
Write-Host "=== Test 3: dq_testcases ===" -ForegroundColor Yellow
$query = @"
{"query": "{ dq_testcases { items { testcase_id testcase_name source_id owner is_active } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $query
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Red }
    } else {
        $testcases = $resp.data.dq_testcases.items
        Write-Host "Found $($testcases.Count) testcases:" -ForegroundColor Green
        foreach ($t in $testcases) {
            Write-Host "  ID=$($t.testcase_id): $($t.testcase_name) (owner: $($t.owner))"
        }
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

# Test 4: Query dq_checks table
Write-Host ""
Write-Host "=== Test 4: dq_checks ===" -ForegroundColor Yellow
$query = @"
{"query": "{ dq_checks { items { check_id testcase_id check_name metric table_name column_name is_active } } }"}
"@

try {
    $resp = Invoke-RestMethod -Uri $endpoint -Method Post -Headers $headers -Body $query
    if ($resp.errors) {
        Write-Host "Error:" -ForegroundColor Red
        $resp.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Red }
    } else {
        $checks = $resp.data.dq_checks.items
        Write-Host "Found $($checks.Count) checks:" -ForegroundColor Green
        foreach ($c in $checks) {
            Write-Host "  ID=$($c.check_id): $($c.check_name) [$($c.metric)]"
        }
    }
} catch {
    Write-Host "Request failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
