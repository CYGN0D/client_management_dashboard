# Cliento — Local & Production Setup Guide

This guide walks you through configuring and running **Cliento** with Core PHP 8.2+ and MySQL 8.0+.

---

## 1. System Requirements

- **PHP:** Version 8.2 or 8.3+ with the following extensions enabled:
  - `pdo`
  - `pdo_mysql`
  - `mbstring`
  - `curl`
  - `json`
- **Database:** MySQL 8.0+ (or MariaDB 10.6+) with InnoDB engine and `utf8mb4` support.
- **Web Server:** PHP Built-in Server (for local development), Apache 2.4+ (with `mod_rewrite`), or Nginx 1.20+.
- **Frontend Browser:** Modern evergreen browser (Chrome, Firefox, Safari, Edge). Vanilla JavaScript only — zero Node.js build steps or npm installations required.

---

## 2. Quick Local Development Setup

### Step 1: Initialize MySQL Database
Log in to MySQL as `root`:
```bash
sudo mysql
```

Run the following SQL commands to create the database and dedicated user:
```sql
CREATE DATABASE IF NOT EXISTS cliento_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'cliento_user'@'localhost' IDENTIFIED BY 'ClientoSecure@2026';
GRANT ALL PRIVILEGES ON cliento_db.* TO 'cliento_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 2: Apply Database Schema & Initial Seed
Import the normalized schema and default seed data:
```bash
mysql -u cliento_user -p'ClientoSecure@2026' cliento_db < database/schema.sql
mysql -u cliento_user -p'ClientoSecure@2026' cliento_db < database/seeds/seed_default.sql
```

The seed script creates the initial administrator account:
- **Email:** `admin@cliento.com`
- **Password:** `admin123`

### Step 3: Configure Database Connection
Configuration parameters are located in `config/database.php`. By default, the application connects using:
- **Host:** `127.0.0.1`
- **Port:** `3306`
- **Database:** `cliento_db`
- **Username:** `cliento_user`
- **Password:** `ClientoSecure@2026`

To override these settings without altering code, export environment variables:
```bash
export DB_HOST="127.0.0.1"
export DB_PORT="3306"
export DB_NAME="cliento_db"
export DB_USER="cliento_user"
export DB_PASS="ClientoSecure@2026"
```

### Step 4: Run the Automated Test Suite
Verify that your PHP and MySQL environment pass all architectural checks:
```bash
php tests/run_tests.php
```
You should see all 62 tests pass:
```
====================================================================
  TEST SUMMARY
====================================================================
  Total Passed: 62
  Total Failed: 0

All architecture and business logic tests passed successfully!
```

### Step 5: Start the Local PHP Web Server
Start the development server using the project router:
```bash
php -S localhost:8000 index.php
```

Open your browser and navigate to:
```
http://localhost:8000/
```

Log in using the default credentials (`admin@cliento.com` / `admin123`).

---

## 3. Production Deployment Configurations

### 3.1. Apache Configuration (`VirtualHost`)
Ensure `mod_rewrite` is enabled: `sudo a2enmod rewrite`.

Create a VirtualHost configuration (e.g. `/etc/apache2/sites-available/cliento.conf`):
```apache
<VirtualHost *:80>
    ServerName cliento.yourdomain.com
    DocumentRoot /var/www/cliento

    <Directory /var/www/cliento>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        DirectoryIndex index.php index.html
    </Directory>

    # Protect internal configuration and services directories
    <DirectoryMatch "^/var/www/cliento/(config|includes|services|tests|database)">
        Require all denied
    </DirectoryMatch>

    ErrorLog ${APACHE_LOG_DIR}/cliento_error.log
    CustomLog ${APACHE_LOG_DIR}/cliento_access.log combined
</VirtualHost>
```

### 3.2. Nginx Configuration
Create an Nginx server block (e.g. `/etc/nginx/sites-available/cliento`):
```nginx
server {
    listen 80;
    server_name cliento.yourdomain.com;
    root /var/www/cliento;
    index index.php index.html;

    charset utf-8;

    # Block access to hidden files and internal backend directories
    location ~ /\.(?!well-known).* {
        deny all;
    }

    location ~ ^/(config|includes|services|tests|database) {
        deny all;
        return 404;
    }

    # Serve static assets or fallback to index.html / index.php
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Pass PHP scripts to FastCGI
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

---

## 4. Operational Maintenance & Cron Scheduling

To automatically generate monthly retainer invoices on the 1st of every month at 00:05 AM, configure a system cron job:

```bash
# Open crontab editor
crontab -e

# Run monthly retainer generator for active clients on day 1 of every month:
5 0 1 * * /usr/bin/php /var/www/cliento/api/invoices/generate.php month=$(date +\%Y-\%m) >> /var/log/cliento_cron.log 2>&1
```
Because the generation service is completely **idempotent**, running the job multiple times is safe and will never duplicate invoices.
