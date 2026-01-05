# Convert Python percent format to Jupyter notebook format
param(
    [string]$PyFile = "src/Notebook/dq_checker_scan_temp.py",
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

# Resolve paths
$rootDir = Join-Path $PSScriptRoot ".." ".."
$pyPath = Join-Path $rootDir $PyFile

if (-not $OutputFile) {
    $OutputFile = $pyPath -replace '_temp\.py$', '.ipynb' -replace '\.py$', '.ipynb'
}

Write-Host "Converting $pyPath to $OutputFile..." -ForegroundColor Cyan

# Read .py file
$content = Get-Content $pyPath -Raw -Encoding UTF8

# Split into cells based on # %% markers
$parts = $content -split '(?m)^# %%'

$cells = @()

# First part (before any # %%) - make it a code cell if not empty
$firstPart = $parts[0].Trim()
if ($firstPart) {
    $sourceLines = @()
    foreach ($line in ($firstPart -split "`n")) {
        $sourceLines += "$line`n"
    }
    $cells += @{
        cell_type = "code"
        execution_count = $null
        metadata = @{}
        outputs = @()
        source = $sourceLines
    }
}

# Process remaining parts (each starts after # %%)
for ($i = 1; $i -lt $parts.Count; $i++) {
    $part = $parts[$i]

    # Check if it's a markdown cell
    if ($part -match '^\s*\[markdown\]') {
        # Extract markdown content (lines after [markdown] that start with #)
        $lines = $part -split "`n"
        $mdLines = @()
        $startIdx = 1  # Skip the [markdown] line

        for ($j = $startIdx; $j -lt $lines.Count; $j++) {
            $line = $lines[$j]
            if ($line -match '^#\s?(.*)$') {
                $mdLines += $matches[1] + "`n"
            } elseif ($line.Trim() -eq '') {
                if ($mdLines.Count -gt 0) {
                    $mdLines += "`n"
                }
            } else {
                break
            }
        }

        if ($mdLines.Count -gt 0) {
            $cells += @{
                cell_type = "markdown"
                metadata = @{}
                source = $mdLines
            }
        }
    } else {
        # Code cell - get content after the %% marker line
        $codeContent = $part.TrimStart()

        if ($codeContent.Trim()) {
            $sourceLines = @()
            foreach ($line in ($codeContent -split "`n")) {
                $sourceLines += "$line`n"
            }

            $cells += @{
                cell_type = "code"
                execution_count = $null
                metadata = @{}
                outputs = @()
                source = $sourceLines
            }
        }
    }
}

# Create notebook structure with Fabric Python notebook metadata
# IMPORTANT: This metadata format is required for %%tsql magic to work
$notebook = @{
    cells = $cells
    metadata = @{
        kernel_info = @{
            name = "jupyter"
            jupyter_kernel_name = "python3.11"
        }
        kernelspec = @{
            name = "jupyter"
            display_name = "Jupyter"
        }
        language_info = @{
            name = "python"
        }
        microsoft = @{
            language = "python"
            language_group = "jupyter_python"
            ms_spell_check = @{
                ms_spell_check_language = "en"
            }
        }
        nteract = @{
            version = "nteract-front-end@1.0.0"
        }
        spark_compute = @{
            compute_id = "/trident/default"
            session_options = @{
                conf = @{
                    "spark.synapse.nbs.session.timeout" = "1200000"
                }
            }
        }
        dependencies = @{}
    }
    nbformat = 4
    nbformat_minor = 5
}

# Convert to JSON and save
$json = $notebook | ConvertTo-Json -Depth 20
$json | Out-File -FilePath $OutputFile -Encoding UTF8 -NoNewline

Write-Host "Converted successfully!" -ForegroundColor Green
Write-Host "  Input:  $pyPath" -ForegroundColor Gray
Write-Host "  Output: $OutputFile" -ForegroundColor Gray
Write-Host "  Cells:  $($cells.Count)" -ForegroundColor Gray
