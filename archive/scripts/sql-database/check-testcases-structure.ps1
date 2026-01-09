# Check dq_testcases table structure
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$query = @"
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'dq_testcases'
ORDER BY ORDINAL_POSITION
"@

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE `
    --authentication-method ActiveDirectoryServicePrincipal `
    -U $env:AZURE_CLIENT_ID `
    -P $env:AZURE_CLIENT_SECRET `
    -Q $query
