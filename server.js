const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'credify.db');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'credify-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

const dbExists = fs.existsSync(DB_PATH);
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Unable to open database', err);
    process.exit(1);
  }
});

const initSql = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  content TEXT NOT NULL,
  result TEXT NOT NULL,
  confidence REAL NOT NULL,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
`;

if (!dbExists) {
  db.exec(initSql, (err) => {
    if (err) console.error('Database init failed', err);
    else console.log('Database initialized.');
  });
} else {
  db.exec(initSql, (err) => {
    if (err) console.error('Database init failed', err);
  });
}

function analyzeFakeNews(content) {
  const lower = content.toLowerCase();
  const fakeSigns = ['clickbait', 'shocking', 'eyewitness', 'unverified', 'secret', 'conspiracy', 'guaranteed'];
  const trustSigns = ['official', 'report', 'study', 'analysis', 'confirmed', 'facts', 'survey'];

  let score = 0;
  fakeSigns.forEach((term) => { if (lower.includes(term)) score -= 1; });
  trustSigns.forEach((term) => { if (lower.includes(term)) score += 1; });

  let result = 'Unsure';
  let confidence = 0.55;

  if (score <= -2) {
    result = 'Fake News';
    confidence = 0.92;
  } else if (score >= 2) {
    result = 'Not Fake News';
    confidence = 0.9;
  } else {
    confidence = 0.65;
  }

  return {
    label: result,
    confidence,
    reasoning: `Basic content analysis produced a score of ${score}. Replace this with a proper AI service for real detection.`
  };
}

function userFromSession(req) {
  return req.session && req.session.userId ? { id: req.session.userId, email: req.session.email } : null;
}

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const password_hash = await bcrypt.hash(password, 10);
  const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  stmt.run(email.trim().toLowerCase(), password_hash, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }
      return res.status(500).json({ error: 'Registration failed.' });
    }
    req.session.userId = this.lastID;
    req.session.email = email.trim().toLowerCase();
    return res.json({ user: { id: this.lastID, email } });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  db.get('SELECT id, password_hash FROM users WHERE email = ?', email.trim().toLowerCase(), async (err, row) => {
    if (err) return res.status(500).json({ error: 'Login failed.' });
    if (!row) return res.status(401).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    req.session.userId = row.id;
    req.session.email = email.trim().toLowerCase();
    res.json({ user: { id: row.id, email: email.trim().toLowerCase() } });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  const user = userFromSession(req);
  if (!user) return res.json({ user: null });
  res.json({ user });
});

app.post('/api/analyze', (req, res) => {
  const { input } = req.body;
  if (!input || typeof input !== 'string' || !input.trim().length) {
    return res.status(400).json({ error: 'Please provide text, a URL, or image link to analyze.' });
  }

  const analysis = analyzeFakeNews(input.trim());
  const user = userFromSession(req);

  if (user) {
    const stmt = db.prepare('INSERT INTO analyses (user_id, content, result, confidence, summary) VALUES (?, ?, ?, ?, ?)');
    stmt.run(user.id, input.trim(), analysis.label, analysis.confidence, analysis.reasoning, (err) => {
      if (err) console.error('History save failed', err);
    });
  }

  res.json({ analysis, saved: !!user });
});

app.post('/api/analyze-file', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Please provide a file to analyze.' });
  }

  let content = `Uploaded file: ${file.originalname}`;
  if (file.mimetype === 'text/plain' || file.originalname.toLowerCase().endsWith('.txt')) {
    try {
      content = file.buffer.toString('utf8');
      if (!content.trim()) {
        return res.status(400).json({ error: 'Uploaded text file is empty.' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Unable to read uploaded file.' });
    }
  }

  const analysis = analyzeFakeNews(content);
  const user = userFromSession(req);

  if (user) {
    const stmt = db.prepare('INSERT INTO analyses (user_id, content, result, confidence, summary) VALUES (?, ?, ?, ?, ?)');
    stmt.run(user.id, content, analysis.label, analysis.confidence, analysis.reasoning, (err) => {
      if (err) console.error('History save failed', err);
    });
  }

  res.json({ analysis, saved: !!user });
});

app.get('/api/history', (req, res) => {
  const user = userFromSession(req);
  if (!user) return res.status(401).json({ error: 'Login required to see history.' });

  db.all('SELECT id, content, result, confidence, summary, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', user.id, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Unable to load history.' });
    res.json({ history: rows });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Credify backend listening on http://localhost:${PORT}`);
});
