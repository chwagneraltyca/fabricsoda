# DQ Checker

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Fabric Extensibility Toolkit](https://img.shields.io/badge/Fabric-Extensibility%20Toolkit-purple)](https://github.com/microsoft/fabric-extensibility-toolkit)

Microsoft Fabric workload for data quality checking using Soda Core.

## Features

- **22+ Check Templates** - Row counts, null checks, range validation, foreign key checks, custom SQL
- **Data Quality Categories** - Completeness, accuracy, uniqueness, validity, freshness
- **Test Organization** - Group checks into test cases and suites
- **Scan Execution** - Run checks via Python notebooks with Soda Core
- **Results Tracking** - Store and analyze check outcomes over time

## Architecture

```
Frontend (React) → GraphQL API → SQL Database (metadata) → Python Notebook (Soda) → Target DWH
```

## Project Structure

```
Legacy/                        # Flask app (migration source, READ-ONLY)
src/Workload/                  # React frontend (Fabric SDK)
└── app/items/DQCheckerItem/   # TODO: Main item implementation
setup/                         # Database schema
├── poc-schema-ddl.sql         # POC database schema
scripts/                       # Build and deployment
docs/                          # Documentation
```

## Development

```powershell
# Setup
cd scripts && pwsh ./Setup/SetupDevEnvironment.ps1
cd ../src/Workload && npm install

# Run (Terminal 1: DevGateway first, Terminal 2: DevServer second)
cd scripts && pwsh ./Run/StartDevGateway.ps1
cd scripts && pwsh ./Run/StartDevServer.ps1
```

## Status

**Phase:** POC Implementation

See [CLAUDE.md](CLAUDE.md) for detailed project documentation.

---

## Author

**Christian Wagner** - Data Architect & Engineer

## License

MIT License - see [LICENSE](LICENSE) for details.

---

> Built with the [Microsoft Fabric Extensibility Toolkit](https://github.com/microsoft/fabric-extensibility-toolkit)
