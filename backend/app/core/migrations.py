import os
import glob
from sqlmodel import text
from sqlalchemy.ext.asyncio import AsyncConnection

async def run_migrations(conn: AsyncConnection):
    """
    Automatically discovers and runs SQL migrations from the migrations/ directory.
    Uses a 'schema_migrations' table to track which migrations have already been applied.
    """
    print("--- Checking for Database Migrations ---")
    
    # 1. Create migration tracking table if it doesn't exist
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (now() at time zone 'utc')
        )
    """))
    
    # 2. Find all .sql files in the migrations directory
    migration_dir = os.path.join(os.getcwd(), "migrations")
    if not os.path.exists(migration_dir):
        print(f"Migration directory not found at {migration_dir}. Skipping.")
        return

    sql_files = sorted(glob.glob(os.path.join(migration_dir, "*.sql")))
    
    # 3. Get applied migrations
    result = await conn.execute(text("SELECT filename FROM schema_migrations"))
    applied_files = {row[0] for row in result.fetchall()}
    
    # 4. Apply pending migrations
    for sql_path in sql_files:
        filename = os.path.basename(sql_path)
        if filename not in applied_files:
            print(f"Applying migration: {filename}")
            try:
                with open(sql_path, "r") as f:
                    content = f.read()
                    if content.strip():
                        # Split by semicolon if there are multiple statements, 
                        # but simple DO blocks or single statements work fine.
                        await conn.execute(text(content))
                
                # Record success
                await conn.execute(
                    text("INSERT INTO schema_migrations (filename) VALUES (:filename)"),
                    {"filename": filename}
                )
                print(f"Successfully applied {filename}")
            except Exception as e:
                print(f"Error applying migration {filename}: {e}")
                # We break to avoid applying subsequent migrations out of order
                break
        else:
            # print(f"Migration {filename} already applied.")
            pass
            
    print("--- Database Migration Check Complete ---")
