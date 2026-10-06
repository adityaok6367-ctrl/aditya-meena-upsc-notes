const express=require("express");
const session=require("express-session");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");

const app=express();
const PORT=process.env.PORT||3000;
const ROOT=__dirname;
const uploadDir=path.join(ROOT,"uploads");
fs.mkdirSync(uploadDir,{recursive:true});

const db=new Database(path.join(ROOT,"data.db"));
const SITE_URL=process.env.SITE_URL||`http://localhost:${PORT}`;
const SUBJECTS=[
  {slug:'polity',name:'UPSC Polity Notes'},
  {slug:'history',name:'UPSC History Notes'},
  {slug:'geography',name:'UPSC Geography Notes'},
  {slug:'economy',name:'UPSC Economy Notes'},
  {slug:'environment',name:'UPSC Environment Notes'},
  {slug:'science-tech',name:'UPSC Science & Technology Notes'},
  {slug:'current-affairs',name:'UPSC Current Affairs Notes'},
  {slug:'ethics',name:'UPSC Ethics Notes'},
  {slug:'prelims',name:'UPSC Prelims Notes'},
  {slug:'mains',name:'UPSC Mains Notes'}
];
function pageShell(title,description,body){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><meta name="robots" content="index,follow"><link rel="canonical" href="${SITE_URL}${body.path||''}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:type" content="website"><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:'Aditya Meena UPSC Notes',url:SITE_URL})}</script><style>body{font-family:Arial,sans-serif;background:#070b16;color:#f6f7fb;margin:0;padding:24px}.wrap{max-width:1000px;margin:auto}.box{background:#0e1525;border:1px solid #202b42;border-radius:18px;padding:24px;margin:16px 0}a{color:#a99aff;text-decoration:none}.muted{color:#9aa7bd}.tag{display:inline-block;background:#7c5cff22;padding:5px 8px;border-radius:8px;margin:4px}</style></head><body><div class="wrap">${body.html}</div></body></html>`;
}

db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user');
CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,subject TEXT NOT NULL,class_name TEXT NOT NULL,file_name TEXT NOT NULL,stored_name TEXT NOT NULL,created_at TEXT NOT NULL);`);

const adminEmail=process.env.ADMIN_EMAIL||"admin@adityameenanotes.in";
const adminPassword=process.env.ADMIN_PASSWORD||"CHANGE_THIS_PASSWORD";
if(!db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail)){
  db.prepare("INSERT INTO users(email,password,role) VALUES(?,?,?)").run(adminEmail,bcrypt.hashSync(adminPassword,12),"admin");
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({secret:process.env.SESSION_SECRET||"change-this-session-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax"}}));
app.use(express.static(path.join(ROOT,"public")));
app.use("/uploads",express.static(uploadDir));

const storage=multer.diskStorage({
 destination:(req,file,cb)=>cb(null,uploadDir),
 filename:(req,file,cb)=>cb(null,Date.now()+"-"+Math.random().toString(36).slice(2)+path.extname(file.originalname))
});
const upload=multer({storage,limits:{fileSize:20*1024*1024},fileFilter:(req,file,cb)=>{
 const ok=[".pdf",".doc",".docx",".txt"].includes(path.extname(file.originalname).toLowerCase());
 cb(ok?null:new Error("Only PDF/DOC/DOCX/TXT files are allowed"),ok);
}});

function auth(req,res,next){if(!req.session.user)return res.status(401).json({error:"Login required"});next()}
function admin(req,res,next){if(!req.session.user||req.session.user.role!=="admin")return res.status(403).json({error:"Admin access required"});next()}


app.get('/robots.txt',(req,res)=>{res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`)});
app.get('/sitemap.xml',(req,res)=>{
 const notes=db.prepare("SELECT id,created_at FROM notes ORDER BY id DESC").all();
 const urls=[{loc:`${SITE_URL}/`,lastmod:new Date().toISOString().slice(0,10)}];
 SUBJECTS.forEach(s=>urls.push({loc:`${SITE_URL}/upsc/${s.slug}`}));
 notes.forEach(n=>urls.push({loc:`${SITE_URL}/notes/${n.id}`,lastmod:(n.created_at||'').slice(0,10)}));
 const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${u.loc}</loc>${u.lastmod?`<lastmod>${u.lastmod}</lastmod>`:''}</url>`).join('')+'</urlset>';
 res.type('application/xml').send(xml);
});
app.get('/upsc',(req,res)=>res.redirect('/'));
app.get('/upsc/:subject',(req,res)=>{
 const sub=SUBJECTS.find(x=>x.slug===req.params.subject); if(!sub)return res.status(404).send('Not found');
 const rows=db.prepare("SELECT id,title,subject,class_name FROM notes WHERE lower(subject)=lower(?) OR lower(title) LIKE ? ORDER BY id DESC").all(sub.name.replace('UPSC ','').replace(' Notes',''),`%${sub.name.replace('UPSC ','').replace(' Notes','')}%`);
 const links=rows.map(n=>`<div class="box"><h2><a href="/notes/${n.id}">${n.title}</a></h2><p class="muted">${n.subject} · ${n.class_name}</p></div>`).join('')||'<p class="muted">Notes will appear here after upload.</p>';
 res.send(pageShell(`${sub.name} PDF | Aditya Meena UPSC Notes`,`Free UPSC ${sub.name.replace('UPSC ','').replace(' Notes','')} notes, study material and PDF resources.`,{path:`/upsc/${sub.slug}`,html:`<h1>${sub.name}</h1><p class="muted">UPSC study notes and resources from Aditya Meena Notes.</p><p><a href="/">← Home</a></p>${links}`}));
});
app.get('/notes/:id',(req,res)=>{
 const n=db.prepare("SELECT * FROM notes WHERE id=?").get(req.params.id); if(!n)return res.status(404).send('Note not found');
 res.send(pageShell(`${n.title} | UPSC Notes | Aditya Meena`,`Read ${n.title}, a UPSC ${n.subject} study note. Download or open the note PDF/document.`,{path:`/notes/${n.id}`,html:`<h1>${n.title}</h1><p class="muted">${n.subject} · ${n.class_name}</p><p>UPSC study material and notes.</p><p><a href="/uploads/${encodeURIComponent(n.stored_name)}" target="_blank" rel="noopener">Open / Download Note</a></p><p><a href="/">← Back to Aditya Meena UPSC Notes</a></p>`}));
});

app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));
app.post("/api/login",(req,res)=>{
 const {email,password}=req.body||{};
 const u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if(!u||!bcrypt.compareSync(password,u.password))return res.status(401).json({error:"Invalid email or password"});
 req.session.user={id:u.id,email:u.email,role:u.role};res.json({user:req.session.user});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.post("/api/signup",(req,res)=>{
 const {email,password}=req.body||{};
 if(!email||!password||password.length<8)return res.status(400).json({error:"Email and password (8+ characters) required"});
 try{const r=db.prepare("INSERT INTO users(email,password,role) VALUES(?,?,?)").run(email,bcrypt.hashSync(password,12),"user");req.session.user={id:r.lastInsertRowid,email,role:"user"};res.json({user:req.session.user})}
 catch(e){res.status(409).json({error:"Email already registered"})}
});
app.get("/api/notes",(req,res)=>res.json(db.prepare("SELECT id,title,subject,class_name,file_name,created_at FROM notes ORDER BY id DESC").all()));
app.post("/api/notes",admin,upload.single("file"),(req,res)=>{
 if(!req.file)return res.status(400).json({error:"File required"});
 const {title,subject,className}=req.body;
 if(!title||!subject||!className){fs.unlinkSync(req.file.path);return res.status(400).json({error:"Title, subject and class required"});}
 const r=db.prepare("INSERT INTO notes(title,subject,class_name,file_name,stored_name,created_at) VALUES(?,?,?,?,?,datetime('now'))").run(title,subject,className,req.file.originalname,req.file.filename);
 res.json({id:r.lastInsertRowid});
});
app.delete("/api/notes/:id",admin,(req,res)=>{
 const n=db.prepare("SELECT * FROM notes WHERE id=?").get(req.params.id);if(!n)return res.status(404).json({error:"Not found"});
 const f=path.join(uploadDir,n.stored_name);if(fs.existsSync(f))fs.unlinkSync(f);
 db.prepare("DELETE FROM notes WHERE id=?").run(req.params.id);res.json({ok:true});
});
app.get("/sitemap.xml", (req, res) => {
  res.status(200)
    .type("application/xml")
    .sendFile(path.join(__dirname, "public", "sitemap.xml"));
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  res.status(400).json({
    error: err.message || "Request failed"
  });
});

app.listen(PORT, () =>
  console.log(`Aditya Meena Notes running on http://localhost:${PORT}`)
);
