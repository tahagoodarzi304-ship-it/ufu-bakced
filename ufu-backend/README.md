# UFU Store — دیپلوی روی Render + Supabase

## مرحله ۱: ساخت دیتابیس رو Supabase
1. وارد پروژه‌ی Supabase‌ت شو (یا یه پروژه‌ی جدید بساز)
2. برو به Project Settings → Database
3. بخش "Connection string" رو پیدا کن، حالت **URI** رو انتخاب کن
4. یه چیزی شبیه این کپی کن:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxx.supabase.co:5432/postgres
   ```
5. به‌جای `[YOUR-PASSWORD]` رمز دیتابیستو بذار (همون رمزی که موقع ساخت پروژه ست کردی)

نیازی نیست جدولی دستی بسازی — سرور خودش موقع اولین اجرا جدول‌های `products` و `site_config` رو می‌سازه و محصولات فعلی رو داخلش می‌ریزه.

## مرحله ۲: آپلود کد روی GitHub
Render برای دیپلوی نیاز داره کد رو از یه ریپازیتوری GitHub بخونه:
1. یه ریپازیتوری جدید تو GitHub بساز (مثلاً `ufu-backend`)
2. کل محتوای همین پوشه (`server.js`, `package.json`, `public/`) رو توش آپلود کن
   (از GitHub Desktop که قبلاً باهاش کار کردی می‌تونی استفاده کنی)

## مرحله ۳: ساخت سرویس روی Render
1. وارد Render شو → New → Web Service
2. ریپازیتوری `ufu-backend` رو انتخاب کن
3. تنظیمات:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. برو بخش Environment Variables و این دو تا رو اضافه کن:
   - `DATABASE_URL` = همون لینک Supabase از مرحله ۱
   - `ADMIN_PASSWORD` = رمز دلخواه خودت برای پنل مدیریت
5. Deploy رو بزن

بعد از چند دقیقه، Render یه آدرس بهت می‌ده مثل:
```
https://ufu-backend.onrender.com
```

این آدرس از هر جایی (گوشی، کامپیوتر، هرکسی) در دسترسه.

## استفاده
- سایت: `https://ufu-backend.onrender.com`
- پنل مدیریت: `https://ufu-backend.onrender.com/admin.html`
- رمز ورود: همون چیزی که تو `ADMIN_PASSWORD` گذاشتی

## نکته مهم درباره‌ی Render رایگان
پلن رایگان Render بعد از ۱۵ دقیقه بی‌استفاده بودن، سرور رو می‌خوابونه و درخواست بعدی چند ثانیه طول می‌کشه تا دوباره بیدار بشه. برای یه فروشگاه واقعی، بعداً پلن پولی (Starter) رو در نظر بگیر تا همیشه فعال بمونه.
