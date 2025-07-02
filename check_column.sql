SET SERVEROUTPUT ON
SET LINESIZE 200
SET PAGESIZE 1000

DECLARE
    v_count NUMBER;
    v_data_type VARCHAR2(30);
BEGIN
    -- Check if the column exists
    SELECT COUNT(*) INTO v_count
    FROM user_tab_columns 
    WHERE table_name = 'PROCEDURA_ZONA' 
    AND column_name = 'PULSACIONES';
    
    IF v_count > 0 THEN
        -- Get the data type if column exists
        SELECT data_type INTO v_data_type
        FROM user_tab_columns 
        WHERE table_name = 'PROCEDURA_ZONA' 
        AND column_name = 'PULSACIONES';
        
        DBMS_OUTPUT.PUT_LINE('Column PULSACIONES exists with data type: ' || v_data_type);
    ELSE
        DBMS_OUTPUT.PUT_LINE('Column PULSACIONES does not exist in PROCEDURA_ZONA table');
    END IF;
    
    -- Also show the current table structure
    DBMS_OUTPUT.PUT_LINE(CHR(10) || 'Current PROCEDURA_ZONA table structure:');
    FOR col IN (
        SELECT column_name, data_type, data_length, nullable
        FROM user_tab_columns 
        WHERE table_name = 'PROCEDURA_ZONA'
        ORDER BY column_id
    ) LOOP
        DBMS_OUTPUT.PUT_LINE('- ' || col.column_name || ' ' || 
                           col.data_type || 
                           CASE WHEN col.data_type IN ('VARCHAR2','CHAR') THEN '(' || col.data_length || ')' ELSE '' END ||
                           CASE WHEN col.nullable = 'N' THEN ' NOT NULL' ELSE '' END);
    END LOOP;
END;
/
