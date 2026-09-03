// ============================================================
// سرور UFU — نسخه‌ی متصل به دیتابیس واقعی Postgres (Supabase)
// برای هاست روی Render + دیتابیس Supabase
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ufu1404';
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  console.error('❌ متغیر محیطی DATABASE_URL تنظیم نشده! لینک دیتابیس Supabase رو ست کن.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // برای اتصال به Supabase لازمه
});

// ---------------- ساخت جدول‌ها در اولین اجرا ----------------
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT,
      price TEXT,
      category TEXT,
      badge TEXT,
      image TEXT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_config (
      id INT PRIMARY KEY DEFAULT 1,
      data JSONB
    );
  `);

  const configRes = await pool.query('SELECT data FROM site_config WHERE id = 1');
  if (configRes.rows.length === 0) {
    await pool.query('INSERT INTO site_config (id, data) VALUES (1, $1)', [
      JSON.stringify({
        siteTitle: 'UFU | جامه، روایت توست',
        heroImage: 'https://i.ibb.co/JRpyCFwK/Polish.png',
        footerText: 'UFU © تمامی حقوق محفوظ است'
      })
    ]);
  }

  const productsRes = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(productsRes.rows[0].count, 10) === 0) {
    const seed = [
      ['1', 'تیشرت UFU', '۴۹۹,۰۰۰', 'تیشرت', '', 'https://i.ibb.co/3mnGh7H4/00976c5e-9a11-414c-a443-8847667f0c45.jpg'],
      ['2', 'هودی UFU', '۸۹۹,۰۰۰', 'هودی', '', 'https://i.ibb.co/mFM9nMjN/8eb6ed23-59e6-49c9-b44b-ec4cd64e3dc8.jpg'],
      ['3', 'شلوار UFU', '۷۴۹,۰۰۰', 'شلوار', '', 'https://i.ibb.co/xt6JRSC1/b5f285fd-b79b-4382-a73a-2162348c69e4.jpg'],
      ['4', 'کلاه UFU', '۳۴۹,۰۰۰', 'کلاه', '', 'https://i.ibb.co/8L427VzG/fe778884-7988-4d51-95d6-838bab92841f.jpg']
    ];
    for (const p of seed) {
      await pool.query(
        'INSERT INTO products (id, name, price, category, badge, image) VALUES ($1,$2,$3,$4,$5,$6)',
        p
      );
    }
  }

  console.log('✅ دیتابیس آماده است.');
}

// ---------------- نشست‌های ادمین (در حافظه) ----------------
const sessions = new Set();

function send(res, status, data, contentType) {
  contentType = contentType || 'application/json';
  const headers = { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' };
  res.writeHead(status, headers);
  res.end(contentType === 'application/json' ? JSON.stringify(data) : data);
}

function getBody(req) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function isAuthed(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  return token && sessions.has(token);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return send(res, 403, 'دسترسی غیرمجاز', 'text/plain; charset=utf-8');
  }
  fs.readFile(filePath, function (err, content) {
    if (err) {
      return send(res, 404, 'صفحه پیدا نشد', 'text/plain; charset=utf-8');
    }
    const ext = path.extname(filePath);
    send(res, 200, content, MIME[ext] || 'application/octet-stream');
  });
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://' + req.headers.host);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    if (pathname === '/api/site' && req.method === 'GET') {
      const productsRes = await pool.query('SELECT * FROM products ORDER BY id');
      const configRes = await pool.query('SELECT data FROM site_config WHERE id = 1');
      return send(res, 200, {
        products: productsRes.rows,
        config: configRes.rows[0] ? configRes.rows[0].data : {}
      });
    }

    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await getBody(req);
      if (body.password === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(24).toString('hex');
        sessions.add(token);
        return send(res, 200, { token: token });
      }
      return send(res, 401, { error: 'رمز عبور اشتباه است' });
    }

    if (pathname.startsWith('/api/admin/')) {
      if (!isAuthed(req)) {
        return send(res, 401, { error: 'دسترسی غیرمجاز - دوباره وارد شوید' });
      }

      if (pathname === '/api/admin/products' && req.method === 'POST') {
        const body = await getBody(req);
        const id = Date.now().toString();
        const product = {
          id,
          name: body.name || '',
          price: body.price || '',
          category: body.category || '',
          badge: body.badge || '',
          image: body.image || ''
        };
        await pool.query(
          'INSERT INTO products (id, name, price, category, badge, image) VALUES ($1,$2,$3,$4,$5,$6)',
          [product.id, product.name, product.price, product.category, product.badge, product.image]
        );
        return send(res, 200, product);
      }

      const itemMatch = pathname.match(/^\/api\/admin\/products\/([^\/]+)$/);

      if (itemMatch && req.method === 'PUT') {
        const body = await getBody(req);
        const existingRes = await pool.query('SELECT * FROM products WHERE id = $1', [itemMatch[1]]);
        if (existingRes.rows.length === 0) return send(res, 404, { error: 'محصول پیدا نشد' });
        const merged = Object.assign({}, existingRes.rows[0], body, { id: itemMatch[1] });
        await pool.query(
          'UPDATE products SET name=$1, price=$2, category=$3, badge=$4, image=$5 WHERE id=$6',
          [merged.name, merged.price, merged.category, merged.badge, merged.image, itemMatch[1]]
        );
        return send(res, 200, merged);
      }

      if (itemMatch && req.method === 'DELETE') {
        await pool.query('DELETE FROM products WHERE id = $1', [itemMatch[1]]);
        return send(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/config' && req.method === 'PUT') {
        const body = await getBody(req);
        const configRes = await pool.query('SELECT data FROM site_config WHERE id = 1');
        const merged = Object.assign({}, configRes.rows[0] ? configRes.rows[0].data : {}, body);
        await pool.query('UPDATE site_config SET data = $1 WHERE id = 1', [JSON.stringify(merged)]);
        return send(res, 200, merged);
      }

      return send(res, 404, { error: 'مسیر پیدا نشد' });
    }

    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'خطای سرور' });
  }
});

initDb()
  .then(function () {
    server.listen(PORT, function () {
      console.log('✅ سرور UFU در حال اجراست روی پورت ' + PORT);
      console.log('🌐 سایت: http://localhost:' + PORT + '/');
      console.log('🔑 پنل ادمین: http://localhost:' + PORT + '/admin.html');
    });
  })
  .catch(function (err) {
    console.error('❌ اتصال به دیتابیس ناموفق بود:', err.message);
    process.exit(1);
  });
