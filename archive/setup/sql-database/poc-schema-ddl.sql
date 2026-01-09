-- ============================================================================
-- DQ CHECKER POC - Database Schema (Idempotent - safe to re-run)
-- ============================================================================
-- Flow: Frontend (React) -> GraphQL API -> dbo.dq_* tables -> Soda Notebook -> Results
-- Target: soda_db in DQ Checker workspace (NOT metalineage from Data Lineage)
-- ============================================================================

-- Using dbo schema (default) - Fabric SQL DB allows dbo access via SPN
GO

-- ============================================================================
-- DROP ALL (order matters for FK dependencies)
-- ============================================================================

-- Drop views first
DROP VIEW IF EXISTS dbo.vw_active_data_sources;
DROP VIEW IF EXISTS dbo.vw_checks_complete;
DROP VIEW IF EXISTS dbo.vw_fabric_schemas;
DROP VIEW IF EXISTS dbo.vw_fabric_tables;
DROP VIEW IF EXISTS dbo.vw_fabric_columns;
GO

-- Drop stored procedures
DROP PROCEDURE IF EXISTS dbo.sp_create_data_source;
DROP PROCEDURE IF EXISTS dbo.sp_update_data_source;
DROP PROCEDURE IF EXISTS dbo.sp_delete_data_source;
DROP PROCEDURE IF EXISTS dbo.sp_create_testcase;
DROP PROCEDURE IF EXISTS dbo.sp_create_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_freshness_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_schema_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_reference_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_scalar_comparison_check;
DROP PROCEDURE IF EXISTS dbo.sp_create_custom_sql_check;
DROP PROCEDURE IF EXISTS dbo.sp_toggle_check;
DROP PROCEDURE IF EXISTS dbo.sp_delete_check;
GO

-- Drop tables (order matters for FK dependencies)
DROP TABLE IF EXISTS dbo.dq_checks_freshness;
DROP TABLE IF EXISTS dbo.dq_checks_schema;
DROP TABLE IF EXISTS dbo.dq_checks_reference;
DROP TABLE IF EXISTS dbo.dq_checks_scalar;
DROP TABLE IF EXISTS dbo.dq_checks_custom;
DROP TABLE IF EXISTS dbo.dq_checks;
DROP TABLE IF EXISTS dbo.dq_testcases;
DROP TABLE IF EXISTS dbo.dq_sources;
DROP TABLE IF EXISTS dbo.fabric_metadata;
GO

-- ============================================================================
-- TABLES: Core DQ Checker metadata
-- ============================================================================

-- Data Sources table (Fabric warehouses to check)
CREATE TABLE dbo.dq_sources (
    source_id INT IDENTITY(1,1) PRIMARY KEY,
    source_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Testcases table (groups of related checks)
CREATE TABLE dbo.dq_testcases (
    testcase_id INT IDENTITY(1,1) PRIMARY KEY,
    testcase_name NVARCHAR(255) NOT NULL,
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    owner NVARCHAR(100),
    tags NVARCHAR(500),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Base checks table (common fields for all check types)
CREATE TABLE dbo.dq_checks (
    check_id INT IDENTITY(1,1) PRIMARY KEY,
    testcase_id INT NOT NULL REFERENCES dbo.dq_testcases(testcase_id),
    source_id INT NOT NULL REFERENCES dbo.dq_sources(source_id),
    schema_name NVARCHAR(128) NOT NULL,
    table_name NVARCHAR(255) NOT NULL,
    column_name NVARCHAR(255),
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
    required_columns NVARCHAR(MAX), -- JSON array
    forbidden_columns NVARCHAR(MAX), -- JSON array
    column_types NVARCHAR(MAX), -- JSON object
    column_indexes NVARCHAR(MAX), -- JSON object
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
    tolerance_type NVARCHAR(20) -- 'absolute' or 'percentage'
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

CREATE INDEX IX_dq_checks_source ON dbo.dq_checks(source_id);
CREATE INDEX IX_dq_checks_testcase ON dbo.dq_checks(testcase_id);
CREATE INDEX IX_fabric_metadata_source ON dbo.fabric_metadata(source_id);
CREATE INDEX IX_fabric_metadata_schema ON dbo.fabric_metadata(source_id, schema_name);
CREATE INDEX IX_fabric_metadata_table ON dbo.fabric_metadata(source_id, schema_name, table_name);
GO

-- ============================================================================
-- VIEWS: GraphQL API layer
-- ============================================================================

-- Active data sources for dropdowns
CREATE OR ALTER VIEW dbo.vw_active_data_sources AS
SELECT source_id, source_name, description
FROM dbo.dq_sources
WHERE is_active = 1;
GO

-- Complete check view (joins all extensions) - for reading checks
CREATE OR ALTER VIEW dbo.vw_checks_complete AS
SELECT
    c.check_id,
    c.testcase_id,
    c.source_id,
    c.schema_name,
    c.table_name,
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
    -- Freshness extension
    f.freshness_column,
    f.threshold_value AS freshness_threshold_value,
    f.threshold_unit AS freshness_threshold_unit,
    -- Schema extension
    s.required_columns,
    s.forbidden_columns,
    s.column_types,
    s.column_indexes,
    s.warn_required_missing,
    s.warn_forbidden_present,
    s.warn_wrong_type,
    s.warn_wrong_index,
    s.fail_required_missing,
    s.fail_forbidden_present,
    s.fail_wrong_type,
    s.fail_wrong_index,
    -- Reference extension
    r.reference_table,
    r.reference_column,
    r.reference_sql_query,
    -- Scalar extension
    sc.query_a,
    sc.query_b,
    sc.comparison_operator,
    sc.tolerance_value,
    sc.tolerance_type,
    -- Custom SQL extension
    cu.custom_sql_query,
    -- Joined names for display
    ds.source_name,
    tc.testcase_name
FROM dbo.dq_checks c
LEFT JOIN dbo.dq_checks_freshness f ON c.check_id = f.check_id
LEFT JOIN dbo.dq_checks_schema s ON c.check_id = s.check_id
LEFT JOIN dbo.dq_checks_reference r ON c.check_id = r.check_id
LEFT JOIN dbo.dq_checks_scalar sc ON c.check_id = sc.check_id
LEFT JOIN dbo.dq_checks_custom cu ON c.check_id = cu.check_id
LEFT JOIN dbo.dq_sources ds ON c.source_id = ds.source_id
LEFT JOIN dbo.dq_testcases tc ON c.testcase_id = tc.testcase_id;
GO

-- Schemas for cascading dropdown
CREATE OR ALTER VIEW dbo.vw_fabric_schemas AS
SELECT DISTINCT source_id, schema_name
FROM dbo.fabric_metadata
WHERE schema_name IS NOT NULL AND schema_name <> '';
GO

-- Tables for cascading dropdown
CREATE OR ALTER VIEW dbo.vw_fabric_tables AS
SELECT DISTINCT source_id, schema_name, table_name
FROM dbo.fabric_metadata
WHERE table_name IS NOT NULL AND table_name <> '';
GO

-- Columns for cascading dropdown
CREATE OR ALTER VIEW dbo.vw_fabric_columns AS
SELECT source_id, schema_name, table_name, column_name, data_type
FROM dbo.fabric_metadata
WHERE column_name IS NOT NULL AND column_name <> '';
GO

-- ============================================================================
-- STORED PROCEDURES: Data Sources CRUD
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_data_source
    @source_name NVARCHAR(100),
    @description NVARCHAR(500) = NULL,
    @is_active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.dq_sources (source_name, description, is_active)
    VALUES (@source_name, @description, @is_active);

    SELECT * FROM dbo.dq_sources WHERE source_id = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_update_data_source
    @source_id INT,
    @source_name NVARCHAR(100),
    @description NVARCHAR(500) = NULL,
    @is_active BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.dq_sources
    SET source_name = @source_name,
        description = @description,
        is_active = @is_active,
        updated_at = GETDATE()
    WHERE source_id = @source_id;

    SELECT * FROM dbo.dq_sources WHERE source_id = @source_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_delete_data_source
    @source_id INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.dq_sources WHERE source_id = @source_id;

    SELECT @@ROWCOUNT AS deleted_count;
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Testcase CRUD
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_testcase
    @testcase_name NVARCHAR(255),
    @source_id INT,
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.dq_testcases (testcase_name, source_id, owner, tags)
    VALUES (@testcase_name, @source_id, @owner, @tags);

    SELECT * FROM dbo.dq_testcases WHERE testcase_id = SCOPE_IDENTITY();
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Check CRUD (Standard)
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
    @check_name NVARCHAR(255),
    @metric NVARCHAR(50),
    @column_name NVARCHAR(255) = NULL,
    @fail_comparison NVARCHAR(10) = NULL,
    @fail_threshold DECIMAL(18,4) = NULL,
    @warn_comparison NVARCHAR(10) = NULL,
    @warn_threshold DECIMAL(18,4) = NULL,
    @filter_condition NVARCHAR(1000) = NULL,
    @dimension NVARCHAR(50) = 'completeness',
    @severity NVARCHAR(20) = 'high',
    @owner NVARCHAR(100) = NULL,
    @tags NVARCHAR(500) = NULL,
    @is_enabled BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, @metric, @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = SCOPE_IDENTITY();
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Check CRUD (Freshness)
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_freshness_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
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

    -- Insert base check
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, 'freshness', @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    -- Insert freshness extension
    INSERT INTO dbo.dq_checks_freshness (check_id, freshness_column, threshold_value, threshold_unit)
    VALUES (@check_id, @freshness_column, @threshold_value, @threshold_unit);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Check CRUD (Schema Validation)
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_schema_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
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

    -- Insert base check
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, 'schema', @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    -- Insert schema extension
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

-- ============================================================================
-- STORED PROCEDURES: Check CRUD (Reference/FK)
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_reference_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
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

    -- Insert base check
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, 'reference', @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    -- Insert reference extension
    INSERT INTO dbo.dq_checks_reference (check_id, reference_table, reference_column, reference_sql_query)
    VALUES (@check_id, @reference_table, @reference_column, @reference_sql_query);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Check CRUD (Scalar Comparison)
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_scalar_comparison_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
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

    -- Insert base check
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, 'scalar_comparison', @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    -- Insert scalar extension
    INSERT INTO dbo.dq_checks_scalar (check_id, query_a, query_b, comparison_operator, tolerance_value, tolerance_type)
    VALUES (@check_id, @query_a, @query_b, @comparison_operator, @tolerance_value, @tolerance_type);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Check CRUD (Custom SQL)
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_create_custom_sql_check
    @testcase_id INT,
    @source_id INT,
    @schema_name NVARCHAR(128),
    @table_name NVARCHAR(255),
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

    -- Insert base check
    INSERT INTO dbo.dq_checks (
        testcase_id, source_id, schema_name, table_name, column_name,
        check_name, metric, fail_comparison, fail_threshold,
        warn_comparison, warn_threshold, filter_condition,
        dimension, severity, owner, tags, is_enabled
    )
    VALUES (
        @testcase_id, @source_id, @schema_name, @table_name, @column_name,
        @check_name, 'custom_sql', @fail_comparison, @fail_threshold,
        @warn_comparison, @warn_threshold, @filter_condition,
        @dimension, @severity, @owner, @tags, @is_enabled
    );

    SET @check_id = SCOPE_IDENTITY();

    -- Insert custom SQL extension
    INSERT INTO dbo.dq_checks_custom (check_id, custom_sql_query)
    VALUES (@check_id, @custom_sql_query);

    SELECT * FROM dbo.vw_checks_complete WHERE check_id = @check_id;
END;
GO

-- ============================================================================
-- STORED PROCEDURES: Check Utility
-- ============================================================================

CREATE OR ALTER PROCEDURE dbo.sp_toggle_check
    @check_id INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.dq_checks
    SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END,
        updated_at = GETDATE()
    WHERE check_id = @check_id;

    SELECT check_id, is_enabled FROM dbo.dq_checks WHERE check_id = @check_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_delete_check
    @check_id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Extension tables deleted via CASCADE
    DELETE FROM dbo.dq_checks WHERE check_id = @check_id;

    SELECT @@ROWCOUNT AS deleted_count;
END;
GO

-- ============================================================================
-- SEED DATA: Sample source for testing
-- ============================================================================

-- Insert a test data source (NYTaxi sample)
IF NOT EXISTS (SELECT 1 FROM dbo.dq_sources WHERE source_name = 'NYTaxi Sample')
BEGIN
    INSERT INTO dbo.dq_sources (source_name, description, is_active)
    VALUES ('NYTaxi Sample', 'New York Taxi sample dataset in sample_dwh', 1);
END;
GO

PRINT 'DQ Checker POC schema deployed successfully!';
GO
