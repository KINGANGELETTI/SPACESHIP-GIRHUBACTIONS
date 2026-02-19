const http = require('http');
const path = require('path');
const fs = require('fs');

// Remove any existing test database to start clean
const dbPath = path.join(__dirname, 'users.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const { app, db } = require('./server');

let server;
let passed = 0;
let failed = 0;
const PORT = 4567;
const BASE = `http://localhost:${PORT}`;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function request(urlPath, options = {}) {
  const url = `${BASE}${urlPath}`;
  const res = await fetch(url, {
    redirect: 'manual',
    ...options,
  });
  const body = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : await res.text();
  return { status: res.status, body, headers: res.headers };
}

async function runTests() {
  console.log('\n--- Login page ---');
  {
    const { status, body } = await request('/');
    assert(status === 200, 'GET / returns 200');
    assert(body.includes('<title>Login</title>'), 'Login page has correct title');
  }

  console.log('\n--- Signup page ---');
  {
    const { status, body } = await request('/signup');
    assert(status === 200, 'GET /signup returns 200');
    assert(body.includes('<title>Sign Up</title>'), 'Signup page has correct title');
  }

  console.log('\n--- Auth required for main ---');
  {
    const { status, headers } = await request('/main');
    assert(status === 302 || status === 303, 'GET /main redirects when not logged in');
  }

  console.log('\n--- Signup validation ---');
  {
    const { status, body } = await request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', name: '', password: '' }),
    });
    assert(status === 400, 'POST /signup rejects empty fields');
  }

  console.log('\n--- Signup success ---');
  let cookie;
  {
    const { status, body, headers } = await request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
        nickname: 'Testy',
        age: '25',
        phone: '555-1234',
        sex: 'Other',
      }),
    });
    assert(status === 200, 'POST /signup returns 200 for valid data');
    assert(body.success === true, 'Signup returns success');
    cookie = headers.get('set-cookie');
    assert(cookie, 'Session cookie is set after signup');
  }

  console.log('\n--- Duplicate signup ---');
  {
    const { status, body } = await request('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        name: 'Test User',
        password: 'password123',
      }),
    });
    assert(status === 409, 'Duplicate email returns 409');
  }

  console.log('\n--- Get user info ---');
  {
    const { status, body } = await request('/api/user', {
      headers: { Cookie: cookie },
    });
    assert(status === 200, 'GET /api/user returns 200 with session');
    assert(body.email === 'test@example.com', 'User email is correct');
    assert(body.name === 'Test User', 'User name is correct');
    assert(body.nickname === 'Testy', 'Nickname is correct');
    assert(body.age === 25, 'Age is correct');
    assert(body.phone === '555-1234', 'Phone is correct');
    assert(body.sex === 'Other', 'Sex is correct');
    assert(!body.password, 'Password is not exposed in API');
  }

  console.log('\n--- Logout ---');
  {
    const { status, body } = await request('/logout', {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert(status === 200, 'POST /logout returns 200');
    assert(body.success === true, 'Logout returns success');
  }

  console.log('\n--- Login with wrong password ---');
  {
    const { status, body } = await request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
    });
    assert(status === 401, 'Wrong password returns 401');
  }

  console.log('\n--- Login success ---');
  {
    const { status, body, headers } = await request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    assert(status === 200, 'POST /login returns 200');
    assert(body.success === true, 'Login returns success');
    cookie = headers.get('set-cookie');
  }

  console.log('\n--- Access main page when logged in ---');
  {
    const { status, body } = await request('/main', {
      headers: { Cookie: cookie },
    });
    assert(status === 200, 'GET /main returns 200 when logged in');
    assert(body.includes('<title>Welcome</title>'), 'Main page has correct title');
  }

  console.log('\n--- Database schema check ---');
  {
    const info = db.prepare("PRAGMA table_info(users)").all();
    const columns = info.map((c) => c.name);
    assert(columns.includes('email'), 'DB has email column');
    assert(columns.includes('name'), 'DB has name column');
    assert(columns.includes('password'), 'DB has password column');
    assert(columns.includes('nickname'), 'DB has nickname column');
    assert(columns.includes('age'), 'DB has age column');
    assert(columns.includes('phone'), 'DB has phone column');
    assert(columns.includes('sex'), 'DB has sex column');
  }

  // Summary
  console.log(`\n=============================`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`=============================\n`);

  // Cleanup
  db.close();
  server.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  process.exit(failed > 0 ? 1 : 0);
}

server = app.listen(PORT, () => {
  console.log(`Test server on port ${PORT}`);
  runTests().catch((err) => {
    console.error(err);
    db.close();
    server.close();
    process.exit(1);
  });
});
