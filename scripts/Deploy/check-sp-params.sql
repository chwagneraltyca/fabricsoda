-- Check sp_create_testcase parameters
SELECT p.name AS param_name, t.name AS type_name
FROM sys.parameters p
JOIN sys.types t ON p.user_type_id = t.user_type_id
WHERE p.object_id = OBJECT_ID('sp_create_testcase')
ORDER BY p.parameter_id;
GO

-- Check sp_create_check parameters
SELECT p.name AS param_name, t.name AS type_name
FROM sys.parameters p
JOIN sys.types t ON p.user_type_id = t.user_type_id
WHERE p.object_id = OBJECT_ID('sp_create_check')
ORDER BY p.parameter_id;
GO
