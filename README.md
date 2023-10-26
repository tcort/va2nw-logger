# va2nw-logger

Amateur radio contact logging.

**Features**

- Import: ADIF.
- Export: ADIF, Cabrillo, CSV, JSON.
- Search.
- Timekeeping.
- View logs in tabular and narrative formats.
- Auto-fill SKCC data from callsign.
- Auto-suggest callsign from logs, SKCC roster, and Super Check Partials.
- Supports SOTA, POTA, and IOTA.
- Compatible with <a href="https://www.hamstats.com/">HamStats</a>.

## Local Installation

### Prerequisites

Install `node.js`, `npm`, and `git`.

### Install

```
git clone https://github.com/tcort/va2nw-logger/
cd va2nw-logger
npm install
```

### Start

```
npm start
```

### Access

Open your browser and point it at [http://localhost:3000/](http://localhost:3000/)

## Cloud Installation

### Prerequisites

Install `node.js`, `npm`, `pm2`, `nginx`, `certbot`, and `git`.

Get a domain name (or subdomain) to use for this service.

### Install

```
mkdir -p /usr/local/src && cd /usr/local/src
git clone https://github.com/tcort/va2nw-logger/
cd va2nw-logger
npm install
```

### Launch the service

```
pm2 start ecosystem.config.js
pm2 save
```

### Nginx Configuration

Generate an http password file to protect your logs (replace `YOUR_USER_NAME_HERE`
with your username):

```
htpasswd -c /etc/apache2/.htpasswd YOUR_USER_NAME_HERE
```

Use `certbot` to generate SSL certificates (replace `YOUR_EMAIL_ADDR_HERE` with
your e-mail address and `YOUR_DOMAIN_NAME_HERE` with your domain name):

```
certbot certonly --standalone --agree-tos --email YOUR_EMAIL_ADDR_HERE -d YOUR_DOMAIN_NAME_HERE
```

Here we configure nginx as a reverse proxy for the node.js service (edit
and replace `YOUR_DOMAIN_NAME_HERE`):

```
server {
    listen 80;
    listen [::]:80;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name YOUR_DOMAIN_NAME_HERE http2;

    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN_NAME_HERE/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN_NAME_HERE/privkey.pem;

    access_log /var/log/nginx/YOUR_DOMAIN_NAME_HERE.log combined;

    server_tokens off;
    etag off;

    add_header Strict-Transport-Security "max-age=15552000; includeSubDomains; preload";
    add_header X-Content-Type-Options nosniff;
    add_header X-Download-Options noopen;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    if ( $scheme != https ) {
        return 301 https://YOUR_DOMAIN_NAME_HERE$request_uri;
    }

    if ( $host != 'YOUR_DOMAIN_NAME_HERE' ) {
        return 301 https://YOUR_DOMAIN_NAME_HERE$request_uri;
    }

	auth_basic           "Authorized Users Area";
	auth_basic_user_file /etc/apache2/.htpasswd;

	client_max_body_size 10M;

	location / {
		proxy_http_version 1.1;

		proxy_pass http://localhost:3000;
		proxy_redirect off;

		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header Host $http_host;
		proxy_set_header X-NginX-Proxy true;

		proxy_read_timeout 300;
		proxy_connect_timeout 300;
		proxy_send_timeout 300;
	}
}
```
