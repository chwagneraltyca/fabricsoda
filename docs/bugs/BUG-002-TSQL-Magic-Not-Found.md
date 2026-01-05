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

## Root Cause (Suspected)

The notebook is running as **PySpark** instead of **Python** notebook. The `%%tsql` magic is ONLY available in Fabric Python notebooks (not PySpark).

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

## Likely Cause

1. The notebook was uploaded to Fabric when it was still a PySpark notebook
2. Later metadata fixes were uploaded but Fabric retained the original notebook type
3. Need to either:
   - **Option A:** Convert to Python via Fabric UI (Home tab > Language dropdown > Python)
   - **Option B:** Delete and re-create the notebook in Fabric as Python type
   - **Option C:** Upload with correct metadata to a NEW notebook item

## Workaround (Alternative Approach)

If `%%tsql` cannot be made to work, revert to using `notebookutils.data.connect_to_artifact()`:

```python
# Instead of %%tsql magic
conn = notebookutils.data.connect_to_artifact("soda_db", artifact_type="SQLDatabase")
df = conn.query("SELECT * FROM dq_sources")
```

This works in both Python and PySpark notebooks.

## Fix Steps

1. Open notebook in Fabric UI
2. Go to **Home** tab
3. Change **Language** dropdown from "PySpark (Python)" to "Python"
4. Verify kernel shows "Python 3.11" (not Spark)
5. Re-run the `%%tsql` cell

## Files Involved

- [dq_checker_scan.ipynb](../../src/Notebook/dq_checker_scan.ipynb) - Main notebook
- [sync-notebook.ps1](../../scripts/Deploy/sync-notebook.ps1) - Upload script
- [fix-notebook-metadata.ps1](../../scripts/Deploy/fix-notebook-metadata.ps1) - Metadata fix script

## References

- [Use Python experience on Notebook](https://learn.microsoft.com/en-us/fabric/data-engineering/using-python-experience-on-notebook)
- [Run T-SQL code in Fabric Python notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/tsql-magic-command-notebook)
- [Choosing between Python and PySpark Notebooks](https://learn.microsoft.com/en-us/fabric/data-engineering/fabric-notebook-selection-guide)
