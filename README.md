# Aditya Meena UPSC Notes

A Node.js + Express + SQLite UPSC notes website with admin login, document uploads, public note pages and Google SEO basics.

## Features
- UPSC-focused subjects: Polity, History, Geography, Economy, Environment, Science & Technology, Current Affairs, Ethics, Prelims, Mains
- Admin login and protected upload/delete
- PDF/DOC/DOCX/TXT uploads up to 20 MB
- Public SEO-friendly note pages: `/notes/:id`
- Subject landing pages: `/upsc/polity`, `/upsc/history`, etc.
- Dynamic `sitemap.xml` and `robots.txt`
- Mobile responsive UI

## Run locally
1. Install Node.js 18+
2. Extract the project
3. Run `npm install`
4. Set environment variables (recommended):
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `SITE_URL` (example: `https://yourdomain.com`)
5. Run `npm start`
6. Open `http://localhost:3000`

## Google Search
After the site is live, add the domain to Google Search Console, submit `/sitemap.xml`, and use URL Inspection for important pages. Indexing is not guaranteed and can take time.

## Production storage
This demo stores SQLite data and uploaded files on local disk. Use a host with persistent storage, or migrate the database/files to managed cloud storage before relying on it for permanent production data.
