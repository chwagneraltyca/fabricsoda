# BUG-002: Cell magic `%%tsql` not found

**Status:** OPEN
**Severity:** High
**Component:** Fabric Python Notebook (dq_checker_scan.ipynb)
**Date:** 2026-01-05

## Summary

When running the notebook interactively in Fabric, the `%%tsql` magic command fails with:
```
UsageError: Cell magic `%%tsql` not found.
```

## Root Cause

**UNKNOWN** - The notebook IS confirmed to be Python type (not PySpark), and metadata is correct. Further investigation needed.

**Ruled out:** PySpark vs Python notebook type (confirmed Python).

## Investigation Findings

### Metadata Comparison

Downloaded working Python notebook from Fabric and compared metadata - **they are identical**:

| Field | Our Notebook | Working Notebook |
|-------|--------------|------------------|
| `kernelspec.name` | `"jupyter"` | `"jupyter"` |
| `kernel_info.jupyter_kernel_name` | `"python3.11"` | `"python3.11"` |
| `microsoft.language_group` | `"jupyter_python"` | `"jupyter_python"` |

### Documentation Reference

From [Microsoft Learn](https://learn.microsoft.com/en-us/fabric/data-engineering/using-python-experience-on-notebook):
> "After opening a Fabric Notebook, you can switch to *Python* in the language dropdown menu at **Home** tab and **convert the entire notebook set-up to Python**."

This suggests the notebook type is determined **server-side in Fabric**, not just by metadata.

## Possible Causes (To Investigate)

1. **Preview feature limitation** - `%%tsql` magic is in preview and may have restrictions
2. **Workspace/tenant setting** - May require specific Fabric capacity or tenant settings
3. **Notebook session state** - May need kernel restart or fresh session
4. **Missing extension** - The tsql magic may need explicit loading in some cases

## Workaround (Alternative Approach)

If `%%tsql` cannot be made to work, revert to using `notebookutils.data.connect_to_artifact()`:

```python
# Instead of %%tsql magic
conn = notebookutils.data.connect_to_artifact("soda_db", artifact_type="SQLDatabase")
df = conn.query("SELECT * FROM dq_sources")
```

This works in both Python and PySpark notebooks.

## Next Steps (To Try)

1. Verify kernel is "Python 3.11" in Fabric UI (already confirmed Python)
2. Try restarting kernel before running `%%tsql` cell
3. Check if `%%tsql` works in a brand new Python notebook in same workspace
4. Check Fabric admin portal for any preview feature settings
5. If all else fails, use `notebookutils.data.connect_to_artifact()` workaround

## Files Involved

- [dq_checker_scan.ipynb](../../src/Notebook/dq_checker_scan.ipynb) - Main notebook
- [sync-notebook.ps1](../../scripts/Deploy/sync-notebook.ps1) - Upload script
- [fix-notebook-metadata.ps1](../../scripts/Deploy/fix-notebook-metadata.ps1) - Metadata fix script

## References

- [Use Python experience on Notebook](https://learn.microsoft.com/en-us/fabric/data-engineering/using-python-experience-on-notebook)
- [Run T-SQL code in Fabric Python notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/tsql-magic-command-notebook)
- [Choosing between Python and PySpark Notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/fabric-notebook-selection-guide)
