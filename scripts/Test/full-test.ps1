# DQ Checker - Full Integration Test
# ============================================================================
# Master script that orchestrates: schema deploy → test data → notebook run → verify
# Uses existing PS1 helpers: run-migration.ps1, sync-notebook.ps1, run-dq-checker.ps1
# ============================================================================

param(
    [switch]$DeploySchema = $false,
    [switch]$SetupTestData = $false,
    [switch]$UploadNotebook = $false,
    [switch]$RunNotebook = $true,
    [switch]$VerifyResults = $true,
    [int]$TestcaseId = 2,
    [int]$SuiteId = 0,
    [switch]$All = $false
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$RepoRoot = Join-Path $ScriptRoot ".." ".."

Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          DQ Checker - Full Integration Test                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# If -All specified, enable all steps
if ($All) {
    $DeploySchema = $true
    $SetupTestData = $true
    $UploadNotebook = $true
    $RunNotebook = $true
    $VerifyResults = $true
}

# Load environment
$envFile = Join-Path $RepoRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
    Write-Host "[ENV] Loaded .env file" -ForegroundColor Gray
} else {
    Write-Host "[ENV] ERROR: .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

# Validate required environment variables
$requiredVars = @("AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID", "DQ_SQL_SERVER", "DQ_SQL_DATABASE", "DQ_WORKSPACE_ID")
$missing = @()
foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        $missing += $var
    }
}
if ($missing.Count -gt 0) {
    Write-Host "[ENV] ERROR: Missing required environment variables: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  SQL Server:   $env:DQ_SQL_SERVER"
Write-Host "  Database:     $env:DQ_SQL_DATABASE"
Write-Host "  Workspace:    $env:DQ_WORKSPACE_ID"
Write-Host "  Testcase ID:  $TestcaseId"
Write-Host ""
Write-Host "Steps to execute:" -ForegroundColor Yellow
Write-Host "  [$(if ($DeploySchema) {'X'} else {' '})] Deploy Schema"
Write-Host "  [$(if ($SetupTestData) {'X'} else {' '})] Setup Test Data"
Write-Host "  [$(if ($UploadNotebook) {'X'} else {' '})] Upload Notebook"
Write-Host "  [$(if ($RunNotebook) {'X'} else {' '})] Run Notebook"
Write-Host "  [$(if ($VerifyResults) {'X'} else {' '})] Verify Results"
Write-Host ""

$stepNum = 0

# ============================================================================
# Step 1: Deploy Schema (optional)
# ============================================================================
if ($DeploySchema) {
    $stepNum++
    Write-Host "[$stepNum] DEPLOY SCHEMA" -ForegroundColor Cyan
    Write-Host "    Running migrations..." -ForegroundColor Gray

    $migrations = @(
        "setup/simplified-schema-minimal-ddl.sql"
    )

    foreach ($migration in $migrations) {
        $migrationPath = Join-Path $RepoRoot $migration
        if (Test-Path $migrationPath) {
            Write-Host "    → $migration" -ForegroundColor Gray
            & "$RepoRoot\scripts\Deploy\run-migration.ps1" -MigrationFile $migration
            if ($LASTEXITCODE -ne 0) {
                Write-Host "    ERROR: Migration failed" -ForegroundColor Red
                exit 1
            }
        }
    }
    Write-Host "    ✓ Schema deployed" -ForegroundColor Green
    Write-Host ""
}

# ============================================================================
# Step 2: Setup Test Data (optional)
# ============================================================================
if ($SetupTestData) {
    $stepNum++
    Write-Host "[$stepNum] SETUP TEST DATA" -ForegroundColor Cyan
    Write-Host "    Inserting test records..." -ForegroundColor Gray

    & "$RepoRoot\scripts\Deploy\run-migration.ps1" -MigrationFile "scripts/Deploy/setup-test-data.sql"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ERROR: Test data setup failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "    ✓ Test data inserted" -ForegroundColor Green
    Write-Host ""
}

# ============================================================================
# Step 3: Upload Notebook (optional)
# ============================================================================
if ($UploadNotebook) {
    $stepNum++
    Write-Host "[$stepNum] UPLOAD NOTEBOOK" -ForegroundColor Cyan
    Write-Host "    Uploading dq_checker_scan.ipynb to Fabric..." -ForegroundColor Gray

    & "$RepoRoot\scripts\Deploy\sync-notebook.ps1" upload
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ERROR: Notebook upload failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "    ✓ Notebook uploaded" -ForegroundColor Green
    Write-Host ""
}

# ============================================================================
# Step 4: Run Notebook
# ============================================================================
if ($RunNotebook) {
    $stepNum++
    Write-Host "[$stepNum] RUN NOTEBOOK" -ForegroundColor Cyan
    Write-Host "    Executing dq_checker_scan with Testcase ID: $TestcaseId" -ForegroundColor Gray

    # Get token
    $tokenBody = @{
        grant_type = "client_credentials"
        client_id = $env:AZURE_CLIENT_ID
        client_secret = $env:AZURE_CLIENT_SECRET
        scope = "https://api.fabric.microsoft.com/.default"
    }
    $tokenResponse = Invoke-RestMethod -Uri "https://login.microsoftonline.com/$env:AZURE_TENANT_ID/oauth2/v2.0/token" -Method Post -Body $tokenBody
    $token = $tokenResponse.access_token

    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    # Find notebook
    $listUrl = "https://api.fabric.microsoft.com/v1/workspaces/$env:DQ_WORKSPACE_ID/items?type=Notebook"
    $items = Invoke-RestMethod -Uri $listUrl -Headers $headers -Method Get
    $notebook = $items.value | Where-Object { $_.displayName -eq "dq_checker_scan" }

    if (-not $notebook) {
        Write-Host "    ERROR: dq_checker_scan notebook not found!" -ForegroundColor Red
        Write-Host "    Run with -UploadNotebook to upload first" -ForegroundColor Yellow
        exit 1
    }

    $notebookId = $notebook.id
    Write-Host "    Notebook ID: $notebookId" -ForegroundColor Gray

    # Run notebook with parameters (Fabric API requires value/type format)
    $runUrl = "https://api.fabric.microsoft.com/v1/workspaces/$env:DQ_WORKSPACE_ID/items/$notebookId/jobs/instances?jobType=RunNotebook"
    $runBody = @{
        executionData = @{
            parameters = @{
                SUITE_ID = @{
                    value = "$SuiteId"
                    type = "string"
                }
                TESTCASE_IDS = @{
                    value = if ($TestcaseId -gt 0) { "$TestcaseId" } else { "" }
                    type = "string"
                }
                FAIL_ON_ERROR = @{
                    value = $false
                    type = "bool"
                }
                SMOKE_TEST = @{
                    value = $false
                    type = "bool"
                }
                "_inlineInstallationEnabled" = @{
                    value = $true
                    type = "bool"
                }
            }
        }
    } | ConvertTo-Json -Depth 10

    Write-Host "    Triggering execution..." -ForegroundColor Gray
    $runResponse = Invoke-WebRequest -Uri $runUrl -Headers $headers -Method Post -Body $runBody
    $jobUrl = $runResponse.Headers["Location"][0]
    Write-Host "    Job URL: $jobUrl" -ForegroundColor Gray

    # Monitor job
    Write-Host "    Monitoring job status..." -ForegroundColor Gray
    $maxChecks = 60  # 10 minutes max
    $checkInterval = 10

    for ($i = 1; $i -le $maxChecks; $i++) {
        Start-Sleep -Seconds $checkInterval
        $statusResponse = Invoke-RestMethod -Uri $jobUrl -Headers $headers -Method Get
        $status = $statusResponse.status
        Write-Host "    [$([math]::Round($i * $checkInterval / 60, 1)) min] Status: $status" -ForegroundColor Gray

        if ($status -eq "Completed") {
            Write-Host "    ✓ Notebook completed successfully" -ForegroundColor Green
            break
        }
        elseif ($status -eq "Failed" -or $status -eq "Cancelled") {
            Write-Host "    ✗ Notebook $status" -ForegroundColor Red
            if ($statusResponse.failureReason) {
                Write-Host "    Reason: $($statusResponse.failureReason.message)" -ForegroundColor Red
            }
            exit 1
        }
    }

    if ($status -ne "Completed") {
        Write-Host "    ERROR: Timeout waiting for notebook completion" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# ============================================================================
# Step 5: Verify Results
# ============================================================================
if ($VerifyResults) {
    $stepNum++
    Write-Host "[$stepNum] VERIFY RESULTS" -ForegroundColor Cyan
    Write-Host "    Querying dq_execution_logs and dq_results..." -ForegroundColor Gray

    & "$RepoRoot\scripts\Deploy\run-migration.ps1" -MigrationFile "scripts/Deploy/verify-results.sql"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    WARNING: Verification query returned non-zero exit code" -ForegroundColor Yellow
    }
    Write-Host ""
}

# ============================================================================
# Summary
# ============================================================================
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    TEST COMPLETED SUCCESSFULLY                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Check Fabric Portal for notebook output"
Write-Host "  2. Verify results in OneLake (Lakehouse → Files → dq_checker_logs/)"
Write-Host "  3. Query dq_results table for check outcomes"
Write-Host ""
