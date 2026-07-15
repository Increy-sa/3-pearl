# 🚀 Deployment Guide — capsystem.net

> Full-stack deployment on AWS EC2 with Ubuntu, Nginx, PM2, and Let's Encrypt SSL.

---

## المتطلبات (Prerequisites)

| Component     | Version     | Purpose                          |
|---------------|-------------|----------------------------------|
| **Ubuntu**    | 22.04+      | Server OS                        |
| **Node.js**   | 20 LTS      | Runtime for backend & build      |
| **PM2**       | Latest      | Process manager for Node.js      |
| **Nginx**     | Latest      | Reverse proxy & static serving   |
| **Certbot**   | Latest      | SSL certificate (Let's Encrypt)  |
| **Git**       | Latest      | Clone repository                 |

---

## خطوة 1: إعداد السيرفر (Server Setup)

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت الأدوات الأساسية
sudo apt install -y nginx certbot python3-certbot-nginx git curl build-essential

# تثبيت Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت PM2
sudo npm install -g pm2
```

---

## خطوة 2: Clone المشروع

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www

# استبدل الرابط برابط الريبو الخاص بك
git clone https://github.com/YOUR_ORG/3-pearl.git /var/www/capsystem
cd /var/www/capsystem
```

---

## خطوة 3: إعداد Backend

```bash
cd /var/www/capsystem/backend
npm install
```

### إنشاء ملف `.env`

```bash
cp .env.example .env
nano .env
```

**عدّل القيم التالية:**

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="مفتاح-عشوائي-قوي-64-حرف-على-الأقل"
GEMINI_API_KEY="مفتاح-جيميناي-الحقيقي"
PORT=5000
FRONTEND_URL="https://capsystem.net"
BASE_URL="https://capsystem.net"
ADTOPIA_WEBHOOK_SECRET="مفتاح-الويب-هوك-السري"
ENCRYPTION_KEY="مفتاح-تشفير-32-حرف-بالضبط"
RESEND_API_KEY="مفتاح-ريسند-الحقيقي"
EMAIL_FROM="Dot Media Operation <email@capsystem.net>"
```

### توليد Prisma وبناء المشروع

```bash
npx prisma generate
npx prisma db push
npm run build
```

### إنشاء مجلد الرفع

```bash
mkdir -p /var/www/capsystem/backend/uploads
```

---

## خطوة 4: إعداد Frontend

```bash
cd /var/www/capsystem/frontend
npm install
```

### إنشاء ملف `.env`

```bash
echo 'VITE_API_URL=https://capsystem.net' > .env
```

### بناء الفرontend

```bash
npm run build
```

---

## خطوة 5: تشغيل Backend بـ PM2

```bash
cd /var/www/capsystem
cp deployment-configs/ecosystem.config.js .
pm2 start ecosystem.config.js --env production
pm2 save
```

### إعداد التشغيل التلقائي عند إعادة تشغيل السيرفر

```bash
pm2 startup systemd -u $USER --hp /home/$USER
pm2 save
```

---

## خطوة 6: Seed الموظفين

```bash
curl -X POST http://localhost:5000/api/seed-staff
```

هذا ينشئ الحسابات الافتراضية:
- `admin@agency.com` — مدير النظام (ADMIN)
- `am@agency.com` — مدير الحسابات (ACCOUNT_MANAGER)
- `designer@agency.com` — مصمم (DESIGNER)
- `dev@agency.com` — مطور (DEVELOPER)
- `seo@agency.com` — متخصص SEO

> **ملاحظة:** بعد إنشاء الحسابات، عيّن كلمة مرور لكل حساب من لوحة إدارة الموظفين.

---

## خطوة 7: إعداد Nginx

### نسخ ملف الإعداد

```bash
sudo cp /var/www/capsystem/deployment-configs/nginx.conf /etc/nginx/sites-available/capsystem.net
sudo ln -sf /etc/nginx/sites-available/capsystem.net /etc/nginx/sites-enabled/capsystem.net
sudo rm -f /etc/nginx/sites-enabled/default
```

### إعداد مؤقت بدون SSL (لحين الحصول على الشهادة)

```bash
sudo tee /etc/nginx/sites-available/capsystem-temp.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name capsystem.net www.capsystem.net;
    root /var/www/capsystem/frontend/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
    location /uploads/ {
        alias /var/www/capsystem/backend/uploads/;
        try_files $uri =404;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/capsystem-temp.conf /etc/nginx/sites-enabled/capsystem.net
sudo nginx -t && sudo systemctl reload nginx
```

---

## خطوة 8: إعداد SSL (Let's Encrypt)

> ⚠️ **تأكد إن DNS A records تشير إلى IP السيرفر أولاً!**
> - `capsystem.net` → `YOUR_EC2_IP`
> - `www.capsystem.net` → `YOUR_EC2_IP`

```bash
sudo certbot --nginx -d capsystem.net -d www.capsystem.net \
  --non-interactive --agree-tos --email admin@capsystem.net --redirect
```

### تطبيق إعداد Nginx النهائي مع SSL

```bash
sudo cp /var/www/capsystem/deployment-configs/nginx.conf /etc/nginx/sites-available/capsystem.net
sudo ln -sf /etc/nginx/sites-available/capsystem.net /etc/nginx/sites-enabled/capsystem.net
sudo nginx -t && sudo systemctl reload nginx
```

---

## خطوة 9: إعداد Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## 🔒 Webhook URL

المسار الكامل للـ webhook:

```
POST https://capsystem.net/api/webhooks/threepearl
Authorization: Bearer YOUR_WEBHOOK_SECRET
```

---

## ⚡ إعادة النشر السريع (Quick Re-deploy)

بعد push تعديلات جديدة:

```bash
cd /var/www/capsystem
git pull origin main
cd backend && npm install && npx prisma generate && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 restart capsystem-backend
```

أو استخدم السكربت الجاهز:

```bash
bash /var/www/capsystem/deploy-update.sh
```

---

## 🛠 أوامر مفيدة

| Command | Purpose |
|---------|---------|
| `pm2 status` | حالة العمليات |
| `pm2 logs capsystem-backend` | عرض اللوجات مباشرة |
| `pm2 restart capsystem-backend` | إعادة تشغيل الباك اند |
| `sudo nginx -t` | اختبار إعداد Nginx |
| `sudo systemctl reload nginx` | إعادة تحميل Nginx |
| `sudo certbot renew --dry-run` | اختبار تجديد SSL |

---

## 📋 Checklist قبل الإطلاق

- [ ] DNS A records تشير إلى IP السيرفر
- [ ] ملف `backend/.env` يحتوي على القيم الحقيقية
- [ ] ملف `frontend/.env` يحتوي على `VITE_API_URL=https://capsystem.net`
- [ ] `npm run build` ينجح في الـ frontend
- [ ] `npm run build` ينجح في الـ backend
- [ ] PM2 يشتغل والـ backend يستجيب (`curl https://capsystem.net/api/health`)
- [ ] SSL شهادة سارية (`https://capsystem.net`)
- [ ] Seed staff users تم تنفيذه
- [ ] كلمات المرور تم تعيينها للموظفين
- [ ] Webhook URL تم تحديثه
