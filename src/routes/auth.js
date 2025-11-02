const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const database = require('../config/database');
const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  console.log('Login attempt:', { username: req.body.username, ip: req.ip });
  const { username, password } = req.body;

  if (!username || !password) {
    console.log('Login failed: Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const query = `SELECT id_user "id", username, password_hash "password_hash" FROM "user" WHERE username = :username`;
  const binds = { username };
  console.log('Executing query:', query);
  console.log('With binds:', binds);

  try {
    // Check what users exist in the database
    const checkUsersQuery = `SELECT username, password_hash FROM "user"`;
    const usersResult = await database.simpleExecute(checkUsersQuery);
    console.log('All users in database:', usersResult.rows);

    const result = await database.simpleExecute(query, binds);
    console.log('Database query result:', result ? result.rows : 'No result');
    console.log('Rows length:', result && result.rows ? result.rows.length : 'undefined');
    if (!result || !result.rows || result.rows.length === 0) {
      console.log('Login failed: User not found');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // If user found, show the stored hash for debugging
    const foundUser = result.rows[0];
    console.log('Found user:', foundUser.username);
    console.log('Stored hash:', foundUser.password_hash);

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex').toLowerCase();
    console.log('Input password hash:', hashedPassword);
    const isValidPassword = hashedPassword === foundUser.password_hash;
    console.log('Password match:', isValidPassword);
    console.log('Password validation:', isValidPassword ? 'Valid' : 'Invalid');

    if (!isValidPassword) {
      console.log('Login failed: Invalid password');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    const token = jwt.sign(
      { id: foundUser.id, username: foundUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', username);
    res.json({
      message: 'Login successful',
      token,
      user: { id: foundUser.id, username: foundUser.username }
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;