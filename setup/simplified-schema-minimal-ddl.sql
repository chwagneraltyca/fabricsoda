-- ============================================================================
-- DQ CHECKER - Minimal Schema (Tables + Views + Extension SPs only)
-- ============================================================================
-- Based on: SIMPLIFICATION-ANALYSIS.md v3 + MS Fabric GraphQL Best Practices
--
-- Strategy:
--   - Use auto-generated GraphQL mutations for simple CRUD
--   - Use stored procedures ONLY for multi-table operations
--
-- IMPORTANT: This is the RECOMMENDED deployment for production
-- ============================================================================

-- Using dbo schema (default for Fabric SQL DB)
GO

-- ============================================================================
-- DROP ALL (order matters for FK dependencies)
-- ============================================================================

-- Drop views
DROP VIEW IF EXISTS dbo.vw_orphan_testcases;
DROP VIEW IF EXISTS dbo.vw_suite_testcases;
DROP VIEW IF EXISTS dbo.vw_active_data_sources;
DROP VIEW IF EXISTS dbo.vw_checks_complete;
DROP VIEW IF EXISTS dbo.vw_fabric_schemas;
DROP VIEW IF EXISTS dbo.vw_fabric_tables;
DROP VIEW IF EXISTS dbo.vw_fabric_columns;
GO

-- Drop extension stored procedures (only these are needed)
DROP PROCEDURE IF EXISTS dbo.sp_create_freshness_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_schema_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_reference_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_scalar_comparison_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_custom_sql_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_testcase_with_checks;
GO

-- Drop tables (order matters for FK dependencies)
DROP TABLE IF EXISTS dbo.suites_testcases;
DROP TABLE IF EXISTS dbo.dq_checks_freshness;
DROP TABLE IF EXISTS dbo.dq_checks_schema;
DROP TABLE IF EXISTS dbo.dq_checks_reference;
DROP TABLE IF EXISTS dbo.dq_checks_scalar;
DROP TABLE IF EXISTS dbo.dq_checks_custom;
DROP TABLE IF EXISTS dbo.dq_checks;
DROP TABLE IF EXISTS dbo.dq_testcases;
DROP TABLE IF EXISTS dbo.dq_suites;
DROP TABLE IF EXISTS dbo.dq_sources;
DROP TABLE IF EXISTS dbo.fabric_metadata;
GO

-- ============================================================================
-- TABLES: Core DQ Checker metadata
-- ============================================================================

-- Data Sources table (Fabric warehouses to check)
-- CRUD via auto-generated: createDq_sources, updateDq_sources, deleteDq_sources
CREATE TABLE dbo.dq_sources (
    source_id INT IDENTITY(1,1) PRIMARY KEY,
    source_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Suites table (business metadata container)
-- CRUD via auto-generated: createDq_suites, updateDq_suites, deleteDq_suites
CREATE TABLE dbo.dq_suites (
    suite_id INT IDENTITY(1,1) PRIMARY KEY,
    suite_name NVARCHAR(255) NOT NULL,
    suite_code NVARCHAR(50),
    description NVARCHAR(1000),
    category NVARCHAR(100),           -- CRITICAL: business metadata
    data_domain NVARCHAR(100),        -- CRITICAL: business metadata
    execution_order INT DEFAULT 0,     -- Pipeline sequencing
    owner NVARCHAR(100),
    tags NVARCHAR(500),               -- JSON array
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Testcases table (table scope - source + schema + table)
-- CRUD via auto-generated: createDq_testcases, updateDq_testcases, deleteDq_testcases
CREATE TABLE dbo.dq_testcases (
    testcase_id INT IDENTITY(1,1) PRIMARY KEY,
    testcase_name NVARCHAR(255) NOT NULL,
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    schema_name NVARCHAR(128) NOT NULL,
    table_name NVARCHAR(255) NOT NULL,
    owner NVARCHAR(100),
    tags NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Suites-Testcases N:M link table (preserves testcase reuse)
-- CRUD via auto-generated: createSuites_testcases, deleteSuites_testcases
CREATE TABLE dbo.suites_testcases (
    suite_id INT NOT NULL REFERENCES dbo.dq_suites(suite_id) ON DELETE CASCADE,
    testcase_id INT NOT NULL REFERENCES dbo.dq_testcases(testcase_id) ON DELETE CASCADE,
    created_at DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (suite_id, testcase_id)
);
GO

-- Base checks table (DQ rules)
-- CRUD via auto-generated: createDq_checks, updateDq_checks, deleteDq_checks
CREATE TABLE dbo.dq_checks (
    check_id INT IDENTITY(1,1) PRIMARY KEY,
    testcase_id INT NOT NULL REFERENCES dbo.dq_testcases(testcase_id) ON DELETE CASCADE,
    column_name NVARCHAR(255),        -- NULL for table-level checks
    check_name NVARCHAR(255) NOT NULL,
    metric NVARCHAR(50) NOT NULL,
    fail_comparison NVARCHAR(10),
    fail_threshold DECIMAL(18,4),
    warn_comparison NVARCHAR(10),
    warn_threshold DECIMAL(18,4),
    filter_condition NVARCHAR(1000),
    dimension NVARCHAR(50) DEFAULT 'completeness',
    severity NVARCHAR(20) DEFAULT 'high',
    owner NVARCHAR(100),
    tags NVARCHAR(500),
    is_enabled BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Extension: Freshness checks
CREATE TABLE dbo.dq_checks_freshness (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    freshness_column NVARCHAR(255) NOT NULL,
    threshold_value INT NOT NULL,
    threshold_unit NVARCHAR(10) NOT NULL -- 'd', 'h', 'm'
);
GO

-- Extension: Schema validation
CREATE TABLE dbo.dq_checks_schema (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    required_columns NVARCHAR(MAX),
    forbidden_columns NVARCHAR(MAX),
    column_types NVARCHAR(MAX),
    column_indexes NVARCHAR(MAX),
    warn_required_missing BIT DEFAULT 0,
    warn_forbidden_present BIT DEFAULT 0,
    warn_wrong_type BIT DEFAULT 0,
    warn_wrong_index BIT DEFAULT 0,
    fail_required_missing BIT DEFAULT 1,
    fail_forbidden_present BIT DEFAULT 1,
    fail_wrong_type BIT DEFAULT 0,
    fail_wrong_index BIT DEFAULT 0
);
GO

-- Extension: Reference (FK) checks
CREATE TABLE dbo.dq_checks_reference (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    reference_table NVARCHAR(255) NOT NULL,
    reference_column NVARCHAR(255) NOT NULL,
    reference_sql_query NVARCHAR(MAX)
);
GO

-- Extension: Scalar comparison
CREATE TABLE dbo.dq_checks_scalar (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    query_a NVARCHAR(MAX) NOT NULL,
    query_b NVARCHAR(MAX) NOT NULL,
    comparison_operator NVARCHAR(10) NOT NULL DEFAULT '==',
    tolerance_value DECIMAL(18,4),
    tolerance_type NVARCHAR(20)
);
GO

-- Extension: Custom SQL
CREATE TABLE dbo.dq_checks_custom (
    check_id INT PRIMARY KEY REFERENCES dbo.dq_checks(check_id) ON DELETE CASCADE,
    custom_sql_query NVARCHAR(MAX) NOT NULL
);
GO

-- Cached Fabric metadata (for cascading dropdowns)
CREATE TABLE dbo.fabric_metadata (
    metadata_id INT IDENTITY(1,1) PRIMARY KEY,
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    schema_name NVARCHAR(128) NOT NULL,
    table_name NVARCHAR(255),
    column_name NVARCHAR(255),
    data_type NVARCHAR(128),
    refreshed_at DATETIME2 DEFAULT GETDATE()
);
GO

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IX_dq_suites_category ON dbo.dq_suites(category);
CREATE INDEX IX_dq_suites_domain ON dbo.dq_suites(data_domain);
CREATE INDEX IX_dq_testcases_source ON dbo.dq_testcases(source_id);
CREATE INDEX IX_dq_testcases_table ON dbo.dq_testcases(source_id, schema_name, table_name);
CREATE INDEX IX_dq_checks_testcase ON dbo.dq_checks(testcase_id);
CREATE INDEX IX_dq_checks_metric ON dbo.dq_checks(metric);
CREATE INDEX IX_fabric_metadata_source ON dbo.fabric_metadata(source_id);
CREATE INDEX IX_fabric_metadata_schema ON dbo.fabric_metadata(source_id, schema_name);
CREATE INDEX IX_fabric_metadata_table ON dbo.fabric_metadata(source_id, schema_name, table_name);
GO

-- ============================================================================
-- VIEWS: GraphQL API layer
-- ============================================================================

CREATE OR ALTER VIEW dbo.vw_active_data_sources AS
SELECT source_id, source_name, description
FROM dbo.dq_sources
WHERE is_active = 1;
GO

CREATE OR ALTER VIEW dbo.vw_orphan_testcases AS
SELECT t.*
FROM dbo.dq_testcases t
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.suites_testcases st WHERE st.testcase_id = t.testcase_id
);
GO

CREATE OR ALTER VIEW dbo.vw_suite_testcases AS
SELECT
    s.suite_id,
    s.suite_name,
    s.category,
    s.data_domain,
    st.testcase_id,
    t.testcase_name,
    t.source_id,
    ds.source_name,
    t.schema_name,
    t.table_name,
    (SELECT COUNT(*) FROM dbo.dq_checks c WHERE c.testcase_id = t.testcase_id) AS check_count
FROM dbo.dq_suites s
INNER JOIN dbo.suites_testcases st ON s.suite_id = st.suite_id
INNER JOIN dbo.dq_testcases t ON st.testcase_id = t.testcase_id
LEFT JOIN dbo.dq_sources ds ON t.source_id = ds.source_id;
GO

CREATE OR ALTER VIEW dbo.vw_checks_complete AS
SELECT
    c.check_id,
    c.testcase_id,
    t.source_id,
    ds.source_name,
    t.schema_name,
    t.table_name,
    c.column_name,
    c.check_name,
    c.metric,
    c.fail_comparison,
    c.fail_threshold,
    c.warn_comparison,
    c.warn_threshold,
    c.filter_condition,
    c.dimension,
    c.severity,
    c.owner,
    c.tags,
    c.is_enabled,
    c.created_at,
    c.updated_at,
    t.testcase_name,
    f.freshness_column,
    f.threshold_value AS freshness_threshold_value,
    f.threshold_unit AS freshness_threshold_unit,
    sch.required_columns,
    sch.forbidden_columns,
    sch.column_types,
    sch.column_indexes,
    r.reference_table,
    r.reference_column,
    r.reference_sql_query,
    sc.query_a,
    sc.query_b,
    sc.comparison_operator,
    sc.tolerance_value,
    sc.tolerance_type,
    cu.custom_sql_query
FROM dbo.dq_checks c
INNER JOIN dbo.dq_testcases t ON c.testcase_id = t.testcase_id
LEFT JOIN dbo.dq_sources ds ON t.source_id = ds.source_id
LEFT JOIN dbo.dq_checks_freshness f ON c.check_id = f.check_id
LEFT JOIN dbo.dq_checks_schema sch ON c.check_id = sch.check_id
LEFT JOIN dbo.dq_checks_reference r ON c.check_id = r.check_id
LEFT JOIN dbo.dq_checks_scalar sc ON c.check_id = sc.check_id
LEFT JOIN dbo.dq_checks_custom cu ON c.check_id = cu.check_id;
GO

CREATE OR ALTER VIEW dbo.vw_fabric_schemas AS
SELECT DISTINCT source_id, schema_name
FROM dbo.fabric_metadata
WHERE schema_name IS NOT NULL AND schema_name <> '';
GO

CREATE OR ALTER VIEW dbo.vw_fabric_tables AS
SELECT DISTINCT source_id, schema_name, table_name
FROM dbo.fabric_metadata
WHERE table_name IS NOT NULL AND table_name <> '';
GO

CREATE OR ALTER VIEW dbo.vw_fabric_columns AS
SELECT source_id, schema_name, table_name, column_name, data_type
FROM dbo.fabric_metadata
WHERE column_name IS NOT NULL AND column_name <> '';
GO

-- ============================================================================
-- STORED PROCEDURES: ONLY for multi-table operations
-- ============================================================================
-- Simple CRUD uses auto-generated GraphQL mutations:
--   createDq_sources, updateDq_sources, deleteDq_sources
--   createDq_suites, updateDq_suites, deleteDq_suites
--   createDq_testcases, updateDq_testcases, deleteDq_testcases
--   createDq_checks, updateDq_checks, deleteDq_checks
--   createSuites_testcases, deleteSuites_testcases
-- ============================================================================

-- SP 1: Create Freshness Check (inserts into dq_checks + dq_checks_freshness)
CREATE OR ALTER PROCEDURE dbo.sp_create_freshness_check
    @testcase_id INT,
    @check_name NVARCHAR(255),
    @freshness_column NVARCHAR(255),
    @threshold_value INT,
    @threshold_unit NVARCHAR(10),
    @column_name NVARCHAR(255) = NULL,
    @fail_comparison NVARCHAR(10) = NULL,
    @fail_threshold DECIMAL(18,4) = NULL,
    @warn_comparison NVARCHAR(10) = NULL,
    @warn_threshold DECIMAL(18,4) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'timeliness',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @check_id INT;

    INSERT INTO dbo.dq_checks (
        testcase_id, column_name, check_name, metric,
        fail_comparison, fail_threshold, warn_comparison, warn_threshold,
        filter_condition, dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @column_name, @check_name, 'freshness',
        @fail_comparison, @fail_threshold, @warn_comparison, @warn_threshold,
        @filter_condition, @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    INSERT INTO dbo.dq_checks_freshness (check_id, freshness_column, threshold_value, threshold_unit)
    VALUES (@check_id, @freshness_column, @threshold_value, @threshold_unit);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- SP 2: Create Schema Check (inserts into dq_checks + dq_checks_schema)
CREATE OR ALTER PROCEDURE dbo.sp_create_schema_check
    @testcase_id INT,
    @check_name NVARCHAR(255),
    @required_columns NVARCHAR(MAX) = NULL,
    @forbidden_columns NVARCHAR(MAX) = NULL,
    @column_types NVARCHAR(MAX) = NULL,
    @column_indexes NVARCHAR(MAX) = NULL,
    @warn_required_missing BIT = 0,
    @warn_forbidden_present BIT = 0,
    @warn_wrong_type BIT = 0,
    @warn_wrong_index BIT = 0,
    @fail_required_missing BIT = 1,
    @fail_forbidden_present BIT = 1,
    @fail_wrong_type BIT = 0,
    @fail_wrong_index BIT = 0,
    @column_name NVARCHAR(255) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'consistency',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @check_id INT;

    INSERT INTO dbo.dq_checks (
        testcase_id, column_name, check_name, metric,
        filter_condition, dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @column_name, @check_name, 'schema',
        @filter_condition, @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    INSERT INTO dbo.dq_checks_schema (
        check_id, required_columns, forbidden_columns, column_types, column_indexes,
        warn_required_missing, warn_forbidden_present, warn_wrong_type, warn_wrong_index,
        fail_required_missing, fail_forbidden_present, fail_wrong_type, fail_wrong_index
    )
    VALUES (
        @check_id, @required_columns, @forbidden_columns, @column_types, @column_indexes,
        @warn_required_missing, @warn_forbidden_present, @warn_wrong_type, @warn_wrong_index,
        @fail_required_missing, @fail_forbidden_present, @fail_wrong_type, @fail_wrong_index
    );

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- SP 3: Create Reference Check (inserts into dq_checks + dq_checks_reference)
CREATE OR ALTER PROCEDURE dbo.sp_create_reference_check
    @testcase_id INT,
    @column_name NVARCHAR(255),
    @check_name NVARCHAR(255),
    @reference_table NVARCHAR(255),
    @reference_column NVARCHAR(255),
    @reference_sql_query NVARCHAR(MAX) = NULL,
    @fail_comparison NVARCHAR(10) = NULL,
    @fail_threshold DECIMAL(18,4) = NULL,
    @warn_comparison NVARCHAR(10) = NULL,
    @warn_threshold DECIMAL(18,4) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'consistency',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @check_id INT;

    INSERT INTO dbo.dq_checks (
        testcase_id, column_name, check_name, metric,
        fail_comparison, fail_threshold, warn_comparison, warn_threshold,
        filter_condition, dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @column_name, @check_name, 'reference',
        @fail_comparison, @fail_threshold, @warn_comparison, @warn_threshold,
        @filter_condition, @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    INSERT INTO dbo.dq_checks_reference (check_id, reference_table, reference_column, reference_sql_query)
    VALUES (@check_id, @reference_table, @reference_column, @reference_sql_query);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- SP 4: Create Scalar Comparison Check (inserts into dq_checks + dq_checks_scalar)
CREATE OR ALTER PROCEDURE dbo.sp_create_scalar_comparison_check
    @testcase_id INT,
    @check_name NVARCHAR(255),
    @query_a NVARCHAR(MAX),
    @query_b NVARCHAR(MAX),
    @comparison_operator NVARCHAR(10) = '==',
    @tolerance_value DECIMAL(18,4) = NULL,
    @tolerance_type NVARCHAR(20) = NULL,
    @column_name NVARCHAR(255) = NULL,
    @fail_comparison NVARCHAR(10) = NULL,
    @fail_threshold DECIMAL(18,4) = NULL,
    @warn_comparison NVARCHAR(10) = NULL,
    @warn_threshold DECIMAL(18,4) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'accuracy',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @check_id INT;

    INSERT INTO dbo.dq_checks (
        testcase_id, column_name, check_name, metric,
        fail_comparison, fail_threshold, warn_comparison, warn_threshold,
        filter_condition, dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @column_name, @check_name, 'scalar_comparison',
        @fail_comparison, @fail_threshold, @warn_comparison, @warn_threshold,
        @filter_condition, @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    INSERT INTO dbo.dq_checks_scalar (check_id, query_a, query_b, comparison_operator, tolerance_value, tolerance_type)
    VALUES (@check_id, @query_a, @query_b, @comparison_operator, @tolerance_value, @tolerance_type);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- SP 5: Create Custom SQL Check (inserts into dq_checks + dq_checks_custom)
CREATE OR ALTER PROCEDURE dbo.sp_create_custom_sql_check
    @testcase_id INT,
    @check_name NVARCHAR(255),
    @custom_sql_query NVARCHAR(MAX),
    @column_name NVARCHAR(255) = NULL,
    @fail_comparison NVARCHAR(10) = NULL,
    @fail_threshold DECIMAL(18,4) = NULL,
    @warn_comparison NVARCHAR(10) = NULL,
    @warn_threshold DECIMAL(18,4) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'accuracy',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @check_id INT;

    INSERT INTO dbo.dq_checks (
        testcase_id, column_name, check_name, metric,
        fail_comparison, fail_threshold, warn_comparison, warn_threshold,
        filter_condition, dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @column_name, @check_name, 'custom_sql',
        @fail_comparison, @fail_threshold, @warn_comparison, @warn_threshold,
        @filter_condition, @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    INSERT INTO dbo.dq_checks_custom (check_id, custom_sql_query)
    VALUES (@check_id, @custom_sql_query);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- SP 6: Create Testcase with Checks (batch operation for wizard)
-- Optional: Use when creating testcase + multiple checks in one transaction
CREATE OR ALTER PROCEDURE dbo.sp_create_testcase_with_checks
    @testcase_name NVARCHAR(255),
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @suite_id INT = NULL,
    @checks NVARCHAR(MAX) = NULL  -- JSON array of check definitions
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @testcase_id INT;

    -- Auto-generate testcase_name if not provided
    IF @testcase_name IS NULL OR @testcase_name = ''
        SET @testcase_name = @schema_name + '.' + @table_name;

    -- Create testcase
    INSERT INTO dbo.dq_testcases (testcase_name, source_id, schema_name, table_name, owner, tags)
    VALUES (@testcase_name, @source_id, @schema_name, @table_name, @owner, @tags);

    SET @testcase_id = SCOPE_IDENTITY();

    -- Link to suite if provided
    IF @suite_id IS NOT NULL
    BEGIN
        INSERT INTO dbo.suites_testcases (suite_id, testcase_id)
        VALUES (@suite_id, @testcase_id);
    END

    -- Process checks JSON if provided
    -- Note: Individual check creation should use the dedicated SPs or auto-generated mutations
    -- This SP is for atomic testcase creation with optional suite linking

    SELECT * FROM dbo.dq_testcases WHERE testcase_id = @testcase_id;
END;
GO

-- ============================================================================
-- SEED DATA
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.dq_sources WHERE source_name = 'NYTaxi Sample')
BEGIN
    INSERT INTO dbo.dq_sources (source_name, description, is_active)
    VALUES ('NYTaxi Sample', 'New York Taxi sample dataset in sample_dwh', 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.dq_suites WHERE suite_name = 'Daily DQ Checks')
BEGIN
    INSERT INTO dbo.dq_suites (suite_name, suite_code, description, category, data_domain, execution_order, owner)
    VALUES ('Daily DQ Checks', 'SUITE_00001', 'Daily data quality checks for taxi data', 'Production', 'Transportation', 1, 'Data Engineering');
END;
GO

PRINT 'DQ Checker Minimal schema deployed successfully!';
PRINT '';
PRINT 'Tables: 11 (dq_sources, dq_suites, suites_testcases, dq_testcases, dq_checks + 5 extensions + fabric_metadata)';
PRINT 'Views: 7 (vw_active_data_sources, vw_orphan_testcases, vw_suite_testcases, vw_checks_complete, vw_fabric_*)';
PRINT 'Stored Procedures: 6 (extension SPs only - simple CRUD uses auto-generated mutations)';
PRINT '';
PRINT 'Auto-generated mutations available for:';
PRINT '  - dq_sources, dq_suites, dq_testcases, dq_checks, suites_testcases';
PRINT '';
PRINT 'SP-backed mutations for multi-table operations:';
PRINT '  - executesp_create_freshness_check';
PRINT '  - executesp_create_schema_check';
PRINT '  - executesp_create_reference_check';
PRINT '  - executesp_create_scalar_comparison_check';
PRINT '  - executesp_create_custom_sql_check';
PRINT '  - executesp_create_testcase_with_checks';
GO
