# 🚀 ChessArena cPanel Deployment Guide (সম্পূর্ণ বাংলা গাইড)

এই গাইড অনুসরণ করে তুমি তোমার ChessArena প্রজেক্ট cPanel shared hosting এ live করতে পারবে।

---

## 📋 আমাদের ডিপ্লয়মেন্ট প্ল্যান

```
┌─────────────────────────────────────────────────────┐
│  Browser (তোমার ভিজিটর)                             │
│  https://yourdomain.com                             │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌─────────────────┐  ┌─────────────────┐
│  cPanel Hosting  │  │  Render.com     │
│  (Frontend)     │  │  (Backend API + │
│  Static HTML/   │  │   Socket Server)│
│  CSS/JS         │  │   FREE          │
│  yourdomain.com │  │                 │
└────────┬────────┘  └────────┬────────┘
         │                    │
         │           ┌────────┴────────┐
         │           │  MySQL Database │
         │           │  (cPanel তে তৈরি)│
         │           │  FREE           │
         │           └─────────────────┘
         │
    cPanel File Manager
    এ HTML/CSS/JS ফাইল
    আপলোড হবে
```

**কোনটা কোথায় হোস্ট হবে:**
| কোন অংশ | কোথায় হোস্ট | খরচ |
|---------|-------------|------|
| Frontend (HTML/CSS/JS) | cPanel shared hosting | ফ্রি (তোমার existing hosting) |
| Backend API | Render.com | ফ্রি |
| Socket.io Server | Render.com | ফ্রি |
| MySQL Database | cPanel এ MySQL | ফ্রি (তোমার existing hosting) |

---

## ⚡ ধাপ ১ — cPanel এ MySQL Database তৈরি করো

এটা সবচেয়ে প্রথমে করতে হবে।

### ১.১ cPanel এ লগইন করো
```
https://yourdomain.com:2083
(অথবা তোমার hosting provider এর cPanel link)
```

### ১.২ MySQL Databases যাও
cPanel Dashboard → **MySQL Databases** (Database সেকশনে আছে)

### ১.৩ নতুন Database তৈরি করো
```
Create New Database:
- Database name: chess_arena_db    (অথবা যে নাম দিতে চাও)
- ক্লিক করো "Create Database"

ফুল নাম হবে: yourusername_chess_arena_db
(example: abcd12_chess_arena_db)
```

### ১.৪ নতুন Database User তৈরি করো
```
MySQL Users → Add New User:
- Username: chess_user
- Password: একটা strong password দাও (নোট করে রাখো!)
- ক্লিক করো "Create User"

ফুল username হবে: yourusername_chess_user
```

### ১.৫ User কে Database এ Add করো
```
Add User to Database:
- User: yourusername_chess_user (সিলেক্ট করো)
- Database: yourusername_chess_arena_db (সিলেক্ট করো)
- ক্লিক "Add"

Privileges → "ALL PRIVILEGES" চেক করো
→ "Make Changes" ক্লিক করো
```

### ১.⑥ phpMyAdmin এ চেক করো
cPanel → **phpMyAdmin** → তোমার database সিলেক্ট করো
(এখন খালি থাকবে, Prisma টেবিল পরে তৈরি হবে)

### ১.⑦ .env ফাইলে Database URL লিখো
```env
DATABASE_URL="mysql://yourusername_chess_user:YourPassword123@localhost/yourusername_chess_arena_db"
```

**উদাহরণ:**
```env
DATABASE_URL="mysql://abcd12_chess_user:MyS3cr3tP@ss@localhost/abcd12_chess_arena_db"
```

---

## ⚡ ধাপ ২ — Render.com এ Account তৈরি করো (ফ্রি)

Render.com এ আমরা ২টা service চালাবো:
1. Backend API (REST API)
2. Socket.io Server (Real-time)

### ২.১ Render.com এ সাইনআপ
```
1. যাও: https://render.com
2. "Sign Up" → GitHub দিয়ে sign in করো
3. (GitHub account থাকলেই হবে, না থাকলে বানাও)
```

### ②.② GitHub এ Repository তৈরি করো
```
1. যাও: https://github.com/new
2. Repository name: chess-arena
3. Private রাখো
4. "Create repository" ক্লিক

5. তোমার লোকাল প্রজেক্ট folder এ terminal খুলে:
   cd chess-arena
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/chess-arena.git
   git push -u origin main
```

---

## ⚡ ধাপ ৩ — Render.com এ Backend API Deploy

### ৩.১ Render Dashboard → "New" → "Web Service"

### ৩.② GitHub Repository Connect করো
```
- "Connect a repository" ক্লিক
- chess-arena repository সিলেক্ট
```

### ৩.৩ Settings সেট করো
```
Name: chess-arena-backend
Runtime: Node
Build Command: npm install && npx prisma generate
Start Command: node server.js

Environment Variables (Key-Value):
┌────────────────────┬──────────────────────────────────────────────┐
│ NODE_ENV           │ production                                   │
│ DATABASE_URL       │ mysql://user:pass@host/db  (ধাপ ১ এর URL)   │
│ JWT_SECRET         │ তোমার strong secret key                      │
│ PORT               │ 10000                                        │
└────────────────────┴──────────────────────────────────────────────┘
```

### ৩.৪ "Create Free Web Service" ক্লিক করো

**Deploy শেষ হলে URL পাবে:** `https://chess-arena-backend.onrender.com`
এটা নোট করে রাখো!

---

## ⚡ ধাপ ৪ — Prisma Database Migrate (গুরুত্বপূর্ণ!)

Render.com এ deploy হওয়ার পর, টার্মিনালে database তৈরি করতে হবে:

### অপশন A — তোমার কম্পিউটার থেকে (recommended)
```bash
cd chess-arena

# .env ফাইলে cPanel এর MySQL URL দাও
# তারপর:
npx prisma db push
```

### অপশন B — cPanel এর phpMyAdmin থেকে
```
1. cPanel → phpMyAdmin → তোমার database সিলেক্ট
2. "SQL" ট্যাব ক্লিক
3. নিচের SQL paste করো:
```

```sql
CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL PRIMARY KEY,
  `username` VARCHAR(191) NOT NULL UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(191) NOT NULL,
  `rating` INTEGER NOT NULL DEFAULT 1200,
  `gamesPlayed` INTEGER NOT NULL DEFAULT 0,
  `wins` INTEGER NOT NULL DEFAULT 0,
  `losses` INTEGER NOT NULL DEFAULT 0,
  `draws` INTEGER NOT NULL DEFAULT 0,
  `isOnline` BOOLEAN NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL
);

CREATE TABLE `Game` (
  `id` VARCHAR(191) NOT NULL PRIMARY KEY,
  `whitePlayerId` VARCHAR(191) NOT NULL,
  `blackPlayerId` VARCHAR(191) NOT NULL,
  `moves` TEXT NOT NULL DEFAULT '[]',
  `pgn` TEXT NOT NULL DEFAULT '',
  `result` VARCHAR(191) NOT NULL DEFAULT '',
  `resultReason` VARCHAR(191) NOT NULL DEFAULT '',
  `status` VARCHAR(191) NOT NULL DEFAULT 'waiting',
  `roomId` VARCHAR(191) UNIQUE,
  `timeControl` VARCHAR(191) NOT NULL DEFAULT '10+0',
  `initialTime` INTEGER NOT NULL DEFAULT 600,
  `whiteTime` INTEGER NOT NULL DEFAULT 600,
  `blackTime` INTEGER NOT NULL DEFAULT 600,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endedAt` DATETIME(3),
  FOREIGN KEY (`whitePlayerId`) REFERENCES `User`(`id`),
  FOREIGN KEY (`blackPlayerId`) REFERENCES `User`(`id`)
);

CREATE INDEX `Game_whitePlayerId_idx` ON `Game`(`whitePlayerId`);
CREATE INDEX `Game_blackPlayerId_idx` ON `Game`(`blackPlayerId`);
```

---

## ⚡ ধাপ ৫ — Render.com এ Socket Server Deploy

### ৫.১ নতুন Web Service তৈরি করো
Render Dashboard → "New" → "Web Service"

### ৫.② GitHub Repository Connect করো
Same chess-arena repository সিলেক্ট করো

### ৫.③ Root Directory সেট করো
```
Root Directory: mini-services/chess-server
```

### ৫.৪ Settings
```
Name: chess-arena-socket
Runtime: Node
Build Command: npm install
Start Command: node index.js

Environment Variables:
┌────────────────────┬────────────┐
│ PORT               │ 10000      │
└────────────────────┴────────────┘
```

### ৫.⑤ "Create Free Web Service" ক্লিক

**URL পাবে:** `https://chess-arena-socket.onrender.com`
এটাও নোট করে রাখো!

---

## ⚡ ধাপ ৬ — Frontend Build ও cPanel এ আপলোড

### ৬.১ তোমার কম্পিউটারে Build করো
```bash
cd chess-arena

# .env ফাইলে URLs আপডেট করো:
# NEXT_PUBLIC_API_URL=https://chess-arena-backend.onrender.com
# NEXT_PUBLIC_SOCKET_URL=https://chess-arena-socket.onrender.com

# Build করো
npm run build
```

### ৬.② Build Output পাবে
```
out/ ফোল্ডার তৈরি হবে
এটাতে সব HTML/CSS/JS ফাইল থাকবে
```

### ৬.③ cPanel File Manager এ আপলোড

```
1. cPanel → File Manager
2. public_html ফোল্ডার যাও
3. public_html এর ভিতরে সব ডিলিট করো (পুরানো ফাইল থাকলে)
4. out/ ফোল্ডার এর ভিতরের সব ফাইল আপলোড করো public_html এ

   Upload করার উপায়:
   - File Manager এ "Upload" বাটন ক্লিক
   - out/ ফোল্ডার এর সব ফাইল (এবং সাবফোল্ডার) select করে upload
   - অথবা zip করে upload, তারপর extract
```

### ৬.④ .htaccess ফাইল তৈরি করো (গুরুত্বপূর্ণ!)

public_html এ `.htaccess` নামে একটা ফাইল তৈরি করো:

```apache
RewriteEngine On

# সব request index.html এ redirect হবে (SPA routing এর জন্য)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.html [L,QSA]

# CORS headers (API calls এর জন্য)
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</IfModule>
```

---

## ⚡ ধাপ ৭ — Environment Variables আপডেট

### ৭.১ cPanel এর .env ফাইল (তোমার কম্পিউটারে)
```env
DATABASE_URL="mysql://user:pass@host/db"
JWT_SECRET="strong-random-key-32-chars"
NEXT_PUBLIC_API_URL="https://chess-arena-backend.onrender.com"
NEXT_PUBLIC_SOCKET_URL="https://chess-arena-socket.onrender.com"
```

### ৭.② Render.com Backend Environment Variables
Render Dashboard → chess-arena-backend → Environment:
```
NODE_ENV=production
DATABASE_URL=mysql://user:pass@localhost/db
JWT_SECRET=strong-random-key-32-chars
PORT=10000
```

**গুরুত্বপূর্ণ:** Render.com এ DATABASE_URL তে MySQL host হবে তোমার cPanel এর MySQL host।
cPanel এ "Remote MySQL" সেকশনে যাও এবং Render.com এর IP add করো (Allow List)।

---

## ⚡ ধাপ ৮ — cPanel Remote MySQL Access দাও

তোমার cPanel এর MySQL তে Render.com থেকে access দিতে হবে:

```
1. cPanel → "Remote MySQL" (Database সেকশনে)
2. "Add Access Host" এ লিখো: % (সব IP থেকে access দিবে)
   অথবা Render.com এর IP লিখো
3. "Add Host" ক্লিক

4. এখন DATABASE_URL আপডেট করো:
   আগে: mysql://user:pass@localhost/db
   পরে: mysql://user:pass@YOUR_CPANEL_MYSQL_HOST/db

   YOUR_CPANEL_MYSQL_HOST cPanel এর "Databases" → "MySQL Databases" পেজে দেখাবে
   সাধারণত: mysql.yourdomain.com অথবা server_IP
```

---

## ✅ সব রেডি! টেস্ট করো

1. Browser এ যাও: `https://yourdomain.com`
2. Register করো
3. Database এ ইউজার তৈরি হলে সব ঠিক আছে!
4. একটা অ্যাকাউন্ট দিয়ে লগইন করো
5. Room তৈরি করো এবং অন্য ব্রাউজারে জয়েন করো

---

## ❓ সমস্যা হলে

| সমস্যা | সমাধান |
|-------|--------|
| "API request failed" | Render.com URL ঠিক আছে কিনা চেক করো .env এ |
| Database connection error | Remote MySQL access দিয়েছো কিনা চেক করো |
| Socket not connecting | NEXT_PUBLIC_SOCKET_URL ঠিক আছে কিনা দেখো |
| Page not found | .htaccess ফাইল public_html এ আছে কিনা চেক |
| Build error | `npm run build` এর output দেখো error কী |

---

## 📌 গুরুত্বপূর্ণ নোট

1. **Render.com Free Plan** → 15 মিনিট idle রাখলে sleep mode এ যায়, প্রথম request এ ~30 sec লাগবে wake up হতে
2. **MySQL Connection** → cPanel এ Remote MySQL অবশ্যই enable করতে হবে
3. **Environment Variables** → প্রতিটা service এ আলাদা আলাদা দিতে হবে
4. **SSL/HTTPS** → cPanel এ free SSL certificate (Let's Encrypt) দিয়ে HTTPS enable করো
