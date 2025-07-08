const express = require('express');
const mysql = require('mysql2/promise');
const { nanoid } = require('nanoid');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;

// MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root', // your MySQL password
  database: 'url_shortener',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// API to shorten URL
app.post('/api/shorten', async (req, res) => {
  const { longUrl } = req.body;
  if (!longUrl) return res.status(400).json({ error: 'Long URL is required' });

  try {
    // Check if URL already exists
    const [rows] = await pool.query('SELECT * FROM urls WHERE long_url = ?', [longUrl]);
    if (rows.length > 0) {
      const shortUrl = `${req.headers.host}/${rows[0].short_code}`;
      return res.json({ shortUrl });
    }

    // Generate unique short code
    let shortCode;
    while (true) {
      shortCode = nanoid(7);
      const [existing] = await pool.query('SELECT * FROM urls WHERE short_code = ?', [shortCode]);
      if (existing.length === 0) break; // unique
    }

    // Insert into DB
    await pool.query('INSERT INTO urls (long_url, short_code) VALUES (?, ?)', [longUrl, shortCode]);

    const shortUrl = `${req.headers.host}/${shortCode}`;
    res.json({ shortUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Redirect short URL to original
app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM urls WHERE short_code = ?', [shortCode]);
    if (rows.length === 0) return res.status(404).send('URL not found');

    // Increment clicks
    await pool.query('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?', [shortCode]);

    res.redirect(rows[0].long_url);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
