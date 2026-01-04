# Debug Fabric Workspace - list items and check SQL Database
# Usage: pwsh tools/debug-fabric-workspace.ps1 -WorkspaceId "your-workspace-id"
param(
    [Parameter(Mandatory=$true)]
    [string]$WorkspaceId
)

Write-Host "=== Fabric Workspace Debug ===" -ForegroundColor Cyan
Write-Host "Workspace: $WorkspaceId"

# Get token for Fabric API
$token = az account get-access-token --resource "https://api.fabric.microsoft.com" --query accessToken -o tsv
if (-not $token) {
    Write-Host "ERROR: Failed to get Fabric API token. Run 'az login' first." -ForegroundColor Red
    exit 1
}
Write-Host "Token acquired" -ForegroundColor Green

$headers = @{ "Authorization" = "Bearer $token" }

# List all items in workspace
Write-Host "`n=== Workspace Items ===" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$WorkspaceId/items" -Headers $headers -Method Get
    $response.value | ForEach-Object {
        $icon = switch ($_.type) {
            "SQLDatabase" { "[DB]" }
            "Notebook" { "[NB]" }
            "DataPipeline" { "[PL]" }
            "GraphQLApi" { "[GQL]" }
            "Warehouse" { "[DWH]" }
            default { "[$($_.type)]" }
        }
        Write-Host "$icon $($_.displayName)" -ForegroundColor $(if ($_.type -eq "SQLDatabase") { "Yellow" } else { "White" })
    }

    # Find SQL Databases specifically
    $sqlDbs = $response.value | Where-Object { $_.type -eq "SQLDatabase" }
    if ($sqlDbs) {
        Write-Host "`n=== SQL Databases Found ===" -ForegroundColor Cyan
        $sqlDbs | ForEach-Object {
            Write-Host "  Name: $($_.displayName)" -ForegroundColor Yellow
            Write-Host "  ID: $($_.id)"
        }
    } else {
        Write-Host "`nWARNING: No SQL Database found in workspace!" -ForegroundColor Red
    }

} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
