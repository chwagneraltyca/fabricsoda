-- Check what stored procedures exist
SELECT name FROM sys.procedures WHERE name LIKE 'sp_%' ORDER BY name;
GO

-- Check tables
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;
GO
