# Query dq_sources schema
$envFile = Join-Path $PSScriptRoot "../../.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

$query = "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'dq_sources' ORDER BY ORDINAL_POSITION"

sqlcmd -S $env:DQ_SQL_SERVER -d $env:DQ_SQL_DATABASE --authentication-method ActiveDirectoryServicePrincipal -U $env:AZURE_CLIENT_ID -P $env:AZURE_CLIENT_SECRET -Q $query -W
