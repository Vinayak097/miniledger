
import { pool } from "./db.js";

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mobile_no VARCHAR(15) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        friend_name VARCHAR(100) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
        due_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'repaid')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        repaid_at TIMESTAMPTZ
      );
    `);

    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createTables();
