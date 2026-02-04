# Deploy Procurement Platform on Ubuntu 22

Steps to get the app live on an Ubuntu 22 VM.

---

## 1. Prerequisites on the VM

### 1.1 Update system

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js 20 (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should show v20.x
```

### 1.3 Install PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create the app database and user:

```bash
sudo -u postgres psql -c "CREATE USER procurement WITH PASSWORD 'YOUR_DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE procurement OWNER procurement;"
```

Use a strong password and the same value in `DATABASE_URL` in `.env` below.

### 1.4 Install Git

```bash
sudo apt install -y git
```

---

## 2. Clone and run the app

### 2.1 Clone the repo

Replace `YOUR_REPO_URL` with your Git remote (e.g. `https://github.com/your-org/procurement-platform.git` or SSH URL).

```bash
cd /opt   # or another directory you prefer
sudo git clone YOUR_REPO_URL procurement-platform
sudo chown -R $USER:$USER procurement-platform
cd procurement-platform
```

### 2.2 Environment file

```bash
cp .env.example .env
nano .env   # or vim
```

Set at least:

- **DATABASE_URL** — e.g. `postgresql://procurement:YOUR_DB_PASSWORD@localhost:5432/procurement?schema=public`
- **AZURE_AD_CLIENT_ID**, **AZURE_AD_CLIENT_SECRET**, **AZURE_AD_TENANT_ID** — from Azure App Registration
- **NEXTAUTH_SECRET** — generate: `openssl rand -base64 32`
- **NEXTAUTH_URL** — your app URL, e.g. `https://procurement.yourdomain.com` or `http://VM_IP:3000`

Optional: Zoho Books, Resend API key, etc.

**Azure AD:** In Azure Portal → App registration → Authentication, add a **Redirect URI** for your VM URL, e.g. `https://procurement.yourdomain.com/api/auth/callback/azure-ad`.

### 2.3 Install dependencies and build

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
```

Optional: seed and grant super admin (replace with a real user email):

```bash
npm run db:seed
npx tsx scripts/grant-super-admin.ts your-admin@company.com
```

### 2.4 Run in production

**Option A — PM2 (recommended)**

```bash
sudo npm install -g pm2
pm2 start npm --name "procurement" -- start
pm2 save
pm2 startup   # run the command it prints to start on boot
```

**Option B — systemd**

Create `/etc/systemd/system/procurement.service`:

```ini
[Unit]
Description=Procurement Platform
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/procurement-platform
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable procurement
sudo systemctl start procurement
sudo systemctl status procurement
```

(If using systemd, set `User=` to the user that owns the app directory and has the `.env` file.)

---

## 3. Expose the app (pick one)

### 3.1 Firewall only (dev / internal)

```bash
sudo ufw allow 3001/tcp
sudo ufw enable
```

Access at `http://VM_IP:3001`. Set **NEXTAUTH_URL** to that URL and add the same redirect URI in Azure AD.

### 3.2 Nginx reverse proxy (recommended for production)

Install Nginx:

```bash
sudo apt install -y nginx
```

Create a site config, e.g. `/etc/nginx/sites-available/procurement`:

```nginx
server {
    listen 80;
    server_name procurement.yourdomain.com;   # or VM_IP

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/procurement /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Set **NEXTAUTH_URL** to `http://procurement.yourdomain.com` (or `https://...` if you add SSL).

### 3.3 HTTPS with Let’s Encrypt (optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d procurement.yourdomain.com
```

Then set **NEXTAUTH_URL** to `https://procurement.yourdomain.com` and add this redirect URI in Azure AD.

---

## 4. Running behind a corporate proxy

If the VM uses an HTTP/HTTPS proxy for outbound traffic, set proxy environment variables so **npm**, **Prisma**, and the **Node app** can reach the internet.

### 4.1 Set proxy for your shell (replace with your proxy URL and port)

```bash
export HTTP_PROXY="http://proxy.company.com:8080"
export HTTPS_PROXY="http://proxy.company.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

If the proxy requires authentication:

```bash
export HTTP_PROXY="http://user:password@proxy.company.com:8080"
export HTTPS_PROXY="http://user:password@proxy.company.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

### 4.2 Install dependencies and Prisma with proxy

Run these **after** exporting the proxy variables (same shell):

```bash
cd ~/Procurement-Platform   # or your app path
npm ci
```

If **Prisma engine download fails with 403 Forbidden** (common when the proxy blocks or alters requests to `binaries.prisma.sh`), use the checksum-ignore flag and retry:

```bash
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npx prisma generate
npx prisma db push
```

Unset it after if you prefer not to leave it set:

```bash
unset PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING
```

### 4.3 Make the app use the proxy at runtime

The app needs the proxy for outbound calls (e.g. Azure AD sign-in, Zoho API). Set the same proxy variables when starting the app.

**With PM2:** create an ecosystem file so the proxy is always set:

```bash
nano ecosystem.config.js
```

Add (adjust proxy URL):

```javascript
module.exports = {
  apps: [{
    name: 'procurement',
    script: 'npm',
    args: 'start',
    cwd: '/home/admin_/Procurement-Platform',
    env: {
      NODE_ENV: 'production',
      HTTP_PROXY: 'http://proxy.company.com:8080',
      HTTPS_PROXY: 'http://proxy.company.com:8080',
      NO_PROXY: 'localhost,127.0.0.1',
    },
  }],
};
```

Then start with:

```bash
pm2 start ecosystem.config.js
pm2 save
```

**With systemd:** add the proxy variables to the service file:

```ini
[Service]
Environment=HTTP_PROXY=http://proxy.company.com:8080
Environment=HTTPS_PROXY=http://proxy.company.com:8080
Environment=NO_PROXY=localhost,127.0.0.1
```

### 4.4 Optional: persist proxy for npm (current user)

```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
npm config set no-proxy localhost,127.0.0.1
```

### 4.5 If the proxy uses a custom CA certificate

If you get SSL errors (e.g. "unable to get local issuer certificate"), set:

```bash
export NODE_EXTRA_CA_CERTS="/path/to/company-ca-bundle.pem"
```

Use the same variable in your PM2 or systemd environment so the running app trusts the proxy’s certificate.

---

## 5. Checklist

- [ ] Node 20, PostgreSQL, Git installed
- [ ] Database and user created, `DATABASE_URL` in `.env`
- [ ] Repo cloned, `.env` filled (Azure AD, NEXTAUTH_SECRET, NEXTAUTH_URL)
- [ ] Azure AD redirect URI added for the app URL
- [ ] `npm ci`, Prisma generate + db push, `npm run build`
- [ ] App run with PM2 or systemd
- [ ] Firewall or Nginx (and optionally SSL) configured
- [ ] Open app URL and sign in with Azure AD

---

## 6. Useful commands

| Task              | Command |
|-------------------|--------|
| View app logs     | `pm2 logs procurement` or `journalctl -u procurement -f` |
| Restart app       | `pm2 restart procurement` or `sudo systemctl restart procurement` |
| After git pull    | `npm ci && npx prisma generate && npm run build && pm2 restart procurement` |
