import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const multer = require('multer');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max to avoid crashes
  },
});

interface MulterRequest extends express.Request {
  file?: Express.Multer.File;
}

// Database Setup
const db = new Database('studysnap.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    xp INTEGER DEFAULT 0,
    rank TEXT DEFAULT 'Beginner Brain'
  );
  CREATE TABLE IF NOT EXISTS spaced_repetition (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT,
    content TEXT,
    next_review DATE,
    interval_days INTEGER
  );
  CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT,
    accuracy REAL,
    time_spent INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Ensure a default user exists
const user = db.prepare('SELECT * FROM users LIMIT 1').get();
if (!user) {
  db.prepare("INSERT INTO users (xp, rank) VALUES (0, 'Beginner Brain')").run();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Basic CORS handling so the frontend on a different port (e.g. Vite dev server)
  // can call this API directly without being blocked by the browser.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // File Extraction API
  app.post('/api/extract', upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { buffer, mimetype, originalname, size } = req.file;

      if (!buffer || !buffer.length) {
        return res.status(400).json({ error: 'Uploaded file is empty.' });
      }

      const ext = path.extname(originalname || '').toLowerCase();
      const isPdf =
        mimetype === 'application/pdf' || ext === '.pdf';
      const isDocx =
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ext === '.docx';
      const isText =
        (mimetype && mimetype.startsWith('text/')) || ext === '.txt';

      let text = '';

      if (isPdf) {
        try {
          const data = await pdf(buffer);
          text = data.text || '';
        } catch (e: any) {
          console.error('PDF extraction error:', e);
          return res
            .status(400)
            .json({ error: 'Could not read this PDF. Try a simpler or smaller file.' });
        }
      } else if (isDocx) {
        try {
          const result = await mammoth.extractRawText({ buffer });
          text = result.value || '';
        } catch (e: any) {
          console.error('DOCX extraction error:', e);
          return res
            .status(400)
            .json({ error: 'Could not read this Word file. Make sure it is a valid .docx document.' });
        }
      } else if (isText) {
        text = buffer.toString('utf-8');
      } else {
        // Fallback: treat unknown types as UTF‑8 text instead of crashing
        text = buffer.toString('utf-8');
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return res
          .status(400)
          .json({ error: 'No readable text was found in this file.' });
      }

      res.json({ text: trimmed });
    } catch (error: any) {
      console.error('Extraction error:', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to extract text' });
    }
  });

  // Central JSON error handler so upload and other API routes always respond with JSON
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    if (res.headersSent) {
      return next(err);
    }

    const isMulterError = err?.name === 'MulterError';
    const status = isMulterError ? 400 : (err?.status || 500);
    const message = err?.message || (isMulterError ? 'File upload error' : 'Unexpected server error');

    res.status(status).json({ error: message });
  });

  // User Stats API
  app.get('/api/user/stats', (req, res) => {
    const stats = db.prepare('SELECT * FROM users LIMIT 1').get();
    res.json(stats);
  });

  app.post('/api/user/xp', (req, res) => {
    const { amount } = req.body;
    db.prepare('UPDATE users SET xp = xp + ?').run(amount);

    // Simple Rank Logic
    const user = db.prepare('SELECT xp FROM users LIMIT 1').get() as { xp: number };
    let rank = 'Beginner Brain';
    if (user.xp > 5000) rank = 'Rank Holder';
    else if (user.xp > 2000) rank = 'Exam Slayer';
    else if (user.xp > 500) rank = 'Concept Hunter';

    db.prepare('UPDATE users SET rank = ?').run(rank);
    res.json({ success: true, rank });
  });

  // Performance API
  app.post('/api/performance', (req, res) => {
    const { topic, accuracy, time_spent } = req.body;
    db.prepare('INSERT INTO performance (topic, accuracy, time_spent) VALUES (?, ?, ?)').run(topic, accuracy, time_spent);
    res.json({ success: true });
  });

  app.get('/api/performance/report', (req, res) => {
    const report = db.prepare('SELECT topic, AVG(accuracy) as avg_accuracy, SUM(time_spent) as total_time FROM performance GROUP BY topic').all();
    res.json(report);
  });

  // Spaced Repetition API
  app.post('/api/memory-lock', (req, res) => {
    const { topic, content, interval } = req.body;
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    db.prepare('INSERT INTO spaced_repetition (topic, content, next_review, interval_days) VALUES (?, ?, ?, ?)').run(topic, content, nextReview.toISOString(), interval);
    res.json({ success: true });
  });

  app.get('/api/memory-lock/pending', (req, res) => {
    const pending = db.prepare('SELECT * FROM spaced_repetition WHERE next_review <= CURRENT_TIMESTAMP').all();
    res.json(pending);
  });

  app.post('/api/reset', (req, res) => {
    db.prepare('DELETE FROM performance').run();
    db.prepare('DELETE FROM spaced_repetition').run();
    db.prepare("UPDATE users SET xp = 0, rank = 'Beginner Brain'").run();
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
