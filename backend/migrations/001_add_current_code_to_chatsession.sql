-- Initial migration to ensure current_code column exists in chatsession table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chatsession'
        AND column_name = 'current_code'
    ) THEN
        ALTER TABLE chatsession ADD COLUMN current_code TEXT;
    END IF;
END $$;
