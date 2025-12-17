import express from "express";
import cors from "cors";
import pkg from "pg";
import { OAuth2Client } from "google-auth-library";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "path";

// Development
const url = "https://studious-space-dollop-jjp6rp7w9q5hqp66-3000.app.github.dev";
const frontendURL = url;

// Production - serve frontend from backend
// const url = "https://archer-slack.onrender.com";
// const frontendURL = url;

const { Pool } = pkg;

// connects to DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required by most hosted DBs
});

// to store sessions in DB
const PgSession = connectPgSimple(session);

const app = express();
app.use(cors({
  origin: frontendURL,
  credentials: true // allows cookies to be sent (needed for auth)
}));

app.use(express.json()); // app can parse JSON

// SERVING FRONTEND AT THE ROOT
app.use(express.static(path.join(process.cwd(), '../frontend')));

// cookie to remember user sessions
app.use(session({
  store: new PgSession({
    pool: pool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  name: 'archer.sid', // cookie name - custom to avoid conflicts
  proxy: true, // trust Render's proxy
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  }
}));

// Testing
// app.get("/", (req, res) => res.send("Backend + DB is running!"));

// Test DB connection
// app.get("/test-db", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW()");
//     res.json(result.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "db_error" });
//   }
// });

app.post("/api/messages", requireAuth, async (req, res) => {
  const { channel, message, isCode } = req.body;
  // get display name from google login - more secure
  const username = req.session.user?.name;
  if (!username) {
    return res.status(500).json({ error: "session_invalid" });
  }

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

  // $1 refers to first parameter and prevents SQL injection
  try {
    const result = await pool.query(
      `SELECT id, timestamp, username, message, is_code
       FROM messages
       WHERE channel = $1
       ORDER BY timestamp ASC
       LIMIT 100`,
      [channel] // values for parameters - $1
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "fetch_failed" });
  }
});

// DELETE /api/messages/clear - delete ALL messages (admin only)
app.delete("/api/messages/clear", async (req, res) => {
  if (!req.session.user?.isAdmin) {
    return res.status(403).json({ error: "admin_required" });
  }
  
  try {
    await pool.query("DELETE FROM messages;"); // no * needed for DELETE in SQL
    res.json({ status: "cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "clear_failed" });
  }
});

// DELETE /api/messages/channel/:channel - delete all messages from a channel (admin only)
app.delete("/api/messages/channel/:channel", async (req, res) => {
  if (!req.session.user?.isAdmin) {
    return res.status(403).json({ error: "admin_required" });
  }
  
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
  const currentUser = req.session.user?.name;
  const isAdmin = req.session.user?.isAdmin;

  try {
    // First, fetch the message to check ownership
    const message = await pool.query(
      `SELECT username FROM messages WHERE id = $1`,
      [id]
    );

    if (message.rows.length === 0) {
      return res.status(404).json({ error: "message_not_found" });
    }

    const messageOwner = message.rows[0].username;

    // Allow deletion if user is admin OR message owner
    if (!isAdmin && currentUser !== messageOwner) {
      return res.status(403).json({ error: "unauthorized" });
    }

    // Delete the message
    await pool.query(
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
  
  // what we can get from google
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

    // censor data before storing
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : '';
    let displayName = lastInitial ? `${firstName} ${lastInitial}.` : firstName;
    
    if (nameParts[0] === "Kelly" && nameParts[1] === "Lougheed") {
      displayName = "Ms. Lougheed";
    }
    
    let emailUsername = email.split('@')[0]; // email username
    // remove last two chars (grad years) of emailUsername
    if (emailUsername.length > 2) {
      emailUsername = emailUsername.slice(0, -2);
    }
    // star out middle of email for privacy
    if (emailUsername.length > 2) {
      emailUsername = emailUsername.charAt(0) + '***' + emailUsername.charAt(emailUsername.length - 1);
    } else {
      emailUsername = emailUsername.charAt(0) + '***';
    }

    // only I have admin privileges
    const isAdmin = (displayName === "Ms. Lougheed");
    
    // store session and user with first name + last initial and censored email
    req.session.user = { 
      email: emailUsername,
      name: displayName,
      isAdmin: isAdmin
    };
    
    console.log("Setting session user:", req.session.user);
    console.log("Saving session for user:", displayName);
    console.log("Session ID before save:", req.sessionID);

    // save session before redirect due to multiple domains issue
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session save failed");
      }
      console.log("Session saved successfully");
      console.log("Session user after save:", req.session.user);
      console.log("Session ID after save:", req.sessionID);
      res.redirect(frontendURL);
    });
  } catch (e) {
    console.error("OAuth error:", e);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/me", (req, res) => {
  console.log("Session check:", req.session);
  console.log("Session ID:", req.sessionID);
  console.log("User in session:", req.session?.user);
  
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