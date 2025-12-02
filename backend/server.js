import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required by most hosted DBs
});

app.get("/", (req, res) => res.send("Backend + DB is running!"));

// Test DB connection
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/api/messages", async (req, res) => {
  const { channel, username, message, isCode } = req.body;

  try {
    console.log("Incoming:", req.body);
    await pool.query(
      `INSERT INTO messages (channel, username, message, is_code)
       VALUES ($1, $2, $3, $4)`,
      [channel, username, message, isCode]
    );
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "insert_failed" });
  }
});

app.get("/api/messages", async (req, res) => {
  const channel = req.query.channel;

  try {
    const result = await pool.query(
      `SELECT id, timestamp, username, message, is_code
       FROM messages
       WHERE channel = $1
       ORDER BY timestamp ASC
       LIMIT 500`,
      [channel]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "fetch_failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));