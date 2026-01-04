# Upload DQ Checker notebook to Fabric workspace
$ErrorActionPreference = "Stop"

# Set UTF-8 encoding for fab CLI output
$env:PYTHONIOENCODING = "utf-8"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Load environment for fab login
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Write-Host "Uploading notebook to Fabric..." -ForegroundColor Cyan

# Login to fab
Write-Host "Logging in..." -ForegroundColor Gray
fab auth login -u $env:AZURE_CLIENT_ID -p $env:AZURE_CLIENT_SECRET --tenant $env:AZURE_TENANT_ID 2>&1 | Out-Null

# Import notebook
$notebookPath = Join-Path $PSScriptRoot "../../src/Notebook/dq_checker_scan.py"
$notebookPath = (Resolve-Path $notebookPath).Path

Write-Host "Importing from: $notebookPath" -ForegroundColor Gray

try {
    fab import "Soda.Workspace/dq_checker_scan.Notebook" -i $notebookPath --format .py -f 2>&1
    Write-Host "Upload complete!" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
