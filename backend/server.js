import express from "express";
import cors from "cors";
import pkg from "pg";
import { OAuth2Client } from "google-auth-library";
import session from "express-session";
import path from "path";

// Development
const url = "https://studious-space-dollop-jjp6rp7w9q5hqp66-3000.app.github.dev";
const frontendURL = url;

// Production
// const url = "https://archer-slack.onrender.com";
// const frontendURL = "https://archerslack.onrender.com";

const { Pool } = pkg;

const app = express();
app.use(cors({
  origin: frontendURL,
  credentials: true
}));
app.use(express.json());

// Serve static files from frontend
app.use(express.static(path.join(process.cwd(), '../frontend')));

// Cookie to remember user sessions
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));

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
  //const username = req.session.user.name; // auto from login

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

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "not_logged_in" });
  }
  next();
}

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

    // Store session
    req.session.user = { email, name };

    res.redirect(frontendURL);
  } catch (e) {
    console.error("OAuth error:", e);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json(null);
  }
  res.json(req.session.user);
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "logout_failed" });
    }
    res.json({ status: "logged_out" });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));