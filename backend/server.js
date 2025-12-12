import express from "express";
import cors from "cors";
import pkg from "pg";
import { OAuth2Client } from "google-auth-library";

// Development
const url = "https://studious-space-dollop-jjp6rp7w9q5hqp66-3000.app.github.dev";

// Production
// const url = "https://archer-slack.onrender.com";

const { Pool } = pkg;

const app = express();
app.use(cors({
  origin: "*"
}));
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

// DELETE /api/messages/clear - delete ALL messages
app.delete("/api/messages/clear", async (req, res) => {
  try {
    await pool.query("DELETE FROM messages;");
    res.json({ status: "cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "clear_failed" });
  }
});

// DELETE /api/messages/channel/:channel - delete all messages from a channel
app.delete("/api/messages/channel/:channel", async (req, res) => {
  const { channel } = req.params;

  try {
    await pool.query(
      `DELETE FROM messages WHERE channel = $1`,
      [channel]
    );
    res.json({ status: "cleared", channel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "clear_failed" });
  }
});

// DELETE /api/messages/:id - delete a specific message by ID
app.delete("/api/messages/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM messages WHERE id = $1`,
      [id]
    );
    res.json({ status: "deleted", id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "delete_failed" });
  }
});

// OAUTH!!!

app.get("/auth/google", (req, res) => {
  const redirect_uri = url + "/auth/google/callback";
  const client_id = process.env.GOOGLE_CLIENT_ID;
  
  const scopes = [
    "openid",
    "profile",
    "email"
  ];

  const authURL =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id,
      redirect_uri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent"
    });

  res.redirect(authURL);
});

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  url + "/auth/google/callback"
);

app.get("/auth/google/callback", async (req, res) => {

  const code = req.query.code;

  try {
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;

    // TODO: store user in DB (if new) or fetch existing user
    // e.g.
    // const result = await pool.query(
    //    "INSERT INTO users (email, name) VALUES ($1, $2)
    //     ON CONFLICT (email) DO UPDATE SET name = $2
    //     RETURNING *",
    //    [email, name]
    // );

    // TODO: create a session or JWT cookie
    // e.g. res.cookie("session", jwt, { httpOnly: true });

    res.redirect(url + "/frontend"); // your frontend
  } catch (e) {
    console.error("OAuth error:", e);
    res.status(500).send("Authentication failed");
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));