# Fix notebook metadata to be Fabric Python notebook (not PySpark)
#
# Fabric Python notebooks require specific metadata format:
# - kernelspec.name = "jupyter"
# - kernel_info.jupyter_kernel_name = "python3.11"
# - microsoft.language_group = "jupyter_python"
#
# Usage: pwsh ./scripts/Deploy/fix-notebook-metadata.ps1

param(
    [string]$NotebookPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $NotebookPath) {
    $NotebookPath = Join-Path $PSScriptRoot ".." ".." "src" "Notebook" "dq_checker_scan.ipynb"
}

Write-Host "Fixing notebook metadata: $NotebookPath" -ForegroundColor Cyan

$nb = Get-Content $NotebookPath -Raw | ConvertFrom-Json

# Set correct Fabric Python notebook metadata
$nb.metadata = @{
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

# Save
$json = $nb | ConvertTo-Json -Depth 50
Set-Content -Path $NotebookPath -Value $json -Encoding UTF8 -NoNewline

Write-Host "Updated notebook metadata for Fabric Python notebook" -ForegroundColor Green
Write-Host ""
Write-Host "Key metadata fields:" -ForegroundColor Yellow
Write-Host "  kernelspec.name = 'jupyter'" -ForegroundColor Gray
Write-Host "  kernel_info.jupyter_kernel_name = 'python3.11'" -ForegroundColor Gray
Write-Host "  microsoft.language_group = 'jupyter_python'" -ForegroundColor Gray
