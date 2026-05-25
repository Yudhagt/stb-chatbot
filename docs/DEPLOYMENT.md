# Stb_Chatbot VPS Deployment Guide

## 1. Server packages

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx git curl build-essential
```

Install Node.js LTS and PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER urbanmotion_prod WITH PASSWORD 'CHANGE_THIS_STRONG_PASSWORD';
CREATE DATABASE urbanmotion_ai OWNER urbanmotion_prod;
GRANT ALL PRIVILEGES ON DATABASE urbanmotion_ai TO urbanmotion_prod;
\q
```

## 3. Upload project

```bash
sudo mkdir -p /var/www/urbanmotion-ai
sudo chown -R $USER:$USER /var/www/urbanmotion-ai
cd /var/www/urbanmotion-ai
```

Copy project files here.

## 4. Backend

```bash
cd /var/www/urbanmotion-ai/backend
cp .env.production.example .env
nano .env
npm install
npm run db:generate
npm run db:push
```

For a stricter production migration workflow, create Prisma migrations locally, commit them, then run:

```bash
npm run db:deploy
```

## 5. Frontend

```bash
cd /var/www/urbanmotion-ai/frontend
cp .env.production.example .env
npm install
npm run build
```

## 6. PM2

```bash
sudo mkdir -p /var/log/urbanmotion-ai
sudo chown -R $USER:$USER /var/log/urbanmotion-ai
cd /var/www/urbanmotion-ai
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 7. Nginx

```bash
sudo cp nginx/urbanmotion.conf /etc/nginx/sites-available/urbanmotion.conf
sudo ln -s /etc/nginx/sites-available/urbanmotion.conf /etc/nginx/sites-enabled/urbanmotion.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8. SSL

```bash
sudo certbot --nginx -d urbanmotion.web.id -d www.urbanmotion.web.id -d api.urbanmotion.web.id
```

## 9. Test

```bash
curl https://api.urbanmotion.web.id/api/health
```

Then open:

```txt
https://urbanmotion.web.id
```
