# Grant Fabric runtime identity access to Key Vault
$roleId = [guid]::NewGuid().ToString()
$subscriptionId = "a08c7639-c870-44d3-acdf-702a8cf87189"
$resourceGroup = "rg-kv"
$vaultName = "chwakv"
$principalId = "c7082bf4-7788-400b-b4d8-26eef37f55c2"  # Fabric runtime identity
$roleDefinitionId = "4633458b-17de-408a-b874-0445c86b69e6"  # Key Vault Secrets User

$uri = "https://management.azure.com/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.KeyVault/vaults/$vaultName/providers/Microsoft.Authorization/roleAssignments/$roleId" + "?api-version=2022-04-01"

$body = @{
    properties = @{
        roleDefinitionId = "/subscriptions/$subscriptionId/providers/Microsoft.Authorization/roleDefinitions/$roleDefinitionId"
        principalId = $principalId
        principalType = "ServicePrincipal"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Creating role assignment..."
Write-Host "URI: $uri"
Write-Host "Body: $body"

$bodyFile = [System.IO.Path]::GetTempFileName()
$body | Out-File -FilePath $bodyFile -Encoding utf8

try {
    az rest --method PUT --uri $uri --headers "Content-Type=application/json" --body "@$bodyFile"
    Write-Host "Role assignment created successfully!" -ForegroundColor Green
} finally {
    Remove-Item $bodyFile -ErrorAction SilentlyContinue
}
