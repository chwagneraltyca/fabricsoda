#!/usr/bin/env python3
"""Convert Python notebook format to .ipynb format for Fabric."""

import json
import re
import sys

def convert_py_to_ipynb(py_path: str, ipynb_path: str):
    """Convert a Python file with cell markers to ipynb format."""

    with open(py_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by cell markers
    cell_pattern = r'# %%( \[markdown\])?'

    cells = []
    current_pos = 0

    # Find all cell markers
    matches = list(re.finditer(cell_pattern, content))

    # If no markers, treat entire file as one code cell
    if not matches:
        cells.append({
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": content.splitlines(keepends=True)
        })
    else:
        # Process header before first marker
        if matches[0].start() > 0:
            header = content[:matches[0].start()].strip()
            if header:
                cells.append({
                    "cell_type": "code",
                    "execution_count": None,
                    "metadata": {},
                    "outputs": [],
                    "source": header.splitlines(keepends=True)
                })

        # Process each cell
        for i, match in enumerate(matches):
            is_markdown = match.group(1) is not None

            # Find end of cell
            end_pos = matches[i+1].start() if i+1 < len(matches) else len(content)

            # Extract cell content (skip the marker line)
            marker_end = content.find('\n', match.end())
            cell_content = content[marker_end+1:end_pos].strip()

            if is_markdown:
                # Remove leading # from each line for markdown
                lines = cell_content.split('\n')
                md_lines = []
                for line in lines:
                    if line.startswith('# '):
                        md_lines.append(line[2:])
                    elif line.startswith('#'):
                        md_lines.append(line[1:])
                    else:
                        md_lines.append(line)
                cell_content = '\n'.join(md_lines)

                cells.append({
                    "cell_type": "markdown",
                    "metadata": {},
                    "source": cell_content.splitlines(keepends=True)
                })
            else:
                if cell_content:
                    cells.append({
                        "cell_type": "code",
                        "execution_count": None,
                        "metadata": {},
                        "outputs": [],
                        "source": cell_content.splitlines(keepends=True)
                    })

    # Create notebook structure with Fabric Python (Jupyter) notebook metadata
    # Key: kernel_info.name = "jupyter" and microsoft.language_group = "jupyter_python"
    notebook = {
        "cells": cells,
        "metadata": {
            "kernel_info": {
                "name": "jupyter",
                "jupyter_kernel_name": "python3.11"
            },
            "kernelspec": {
                "name": "jupyter",
                "display_name": "Jupyter"
            },
            "language_info": {
                "name": "python"
            },
            "microsoft": {
                "language": "python",
                "language_group": "jupyter_python"
            },
            "nteract": {
                "version": "nteract-front-end@1.0.0"
            },
            "dependencies": {}
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }

    with open(ipynb_path, 'w', encoding='utf-8') as f:
        json.dump(notebook, f, indent=2, ensure_ascii=False)

    print(f"Converted {py_path} to {ipynb_path}")
    print(f"Created {len(cells)} cells")

if __name__ == "__main__":
    py_path = sys.argv[1] if len(sys.argv) > 1 else "src/Notebook/dq_checker_scan.py"
    ipynb_path = sys.argv[2] if len(sys.argv) > 2 else "src/Notebook/dq_checker_scan.ipynb"
    convert_py_to_ipynb(py_path, ipynb_path)
