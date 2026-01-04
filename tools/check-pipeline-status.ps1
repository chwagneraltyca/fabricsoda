# Check Pipeline Run Status
# Usage: pwsh tools/check-pipeline-status.ps1 -WorkspaceId "..." -PipelineId "..." [-Poll]
param(
    [Parameter(Mandatory=$true)]
    [string]$WorkspaceId,
    [Parameter(Mandatory=$true)]
    [string]$PipelineId,
    [int]$WaitSeconds = 10,
    [switch]$Poll
)

if ($WaitSeconds -gt 0) {
    Write-Host "Waiting $WaitSeconds seconds..." -ForegroundColor Gray
    Start-Sleep -Seconds $WaitSeconds
}

$token = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
$headers = @{ "Authorization" = "Bearer $token" }

function Get-LatestRun {
    $runs = Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/items/$PipelineId/jobs/instances" -Headers $headers -Method Get
    if ($runs.value) {
        return $runs.value | Sort-Object -Property startTimeUtc -Descending | Select-Object -First 1
    }
    return $null
}

$latest = Get-LatestRun
if (-not $latest) {
    Write-Host "No runs found" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Pipeline Run ===" -ForegroundColor Cyan
Write-Host "Run ID: $($latest.id)"
Write-Host "Started: $($latest.startTimeUtc)"

$statusColor = switch ($latest.status) {
    "Succeeded" { "Green" }
    "Failed" { "Red" }
    "InProgress" { "Yellow" }
    default { "White" }
}
Write-Host "Status: $($latest.status)" -ForegroundColor $statusColor

if ($latest.endTimeUtc) {
    Write-Host "Ended: $($latest.endTimeUtc)"
}

if ($latest.failureReason) {
    Write-Host "`nFailure Reason:" -ForegroundColor Red
    Write-Host $latest.failureReason -ForegroundColor Red
}

# Poll mode - keep checking until complete
if ($Poll -and ($latest.status -eq "InProgress" -or $latest.status -eq "NotStarted")) {
    Write-Host "`nPolling for completion..." -ForegroundColor Gray
    while ($latest.status -eq "InProgress" -or $latest.status -eq "NotStarted") {
        Start-Sleep -Seconds 5
        $latest = Get-LatestRun
        Write-Host "Status: $($latest.status)" -ForegroundColor $(if ($latest.status -in @("InProgress", "NotStarted")) { "Yellow" } else { $statusColor })
    }

    Write-Host "`n=== Final Result ===" -ForegroundColor Cyan
    Write-Host "Status: $($latest.status)" -ForegroundColor $(if ($latest.status -eq "Succeeded") { "Green" } else { "Red" })
    if ($latest.failureReason) {
        Write-Host "Failure: $($latest.failureReason)" -ForegroundColor Red
    }
}
