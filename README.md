# Markdown Blog System

A lightweight, file-based blog and website system designed for resource-constrained Linux environments like Raspberry Pi. No database required - all content is stored in markdown files.

## Features

- 📝 Markdown-based content management
- 🔐 Google OAuth authentication
- 🎨 Theme system with easy switching
- 📁 File-based storage (no database)
- 🔄 Automatic content indexing with file watching
- 🖥️ Admin interface for content management
- 🍓 Optimized for Raspberry Pi
- ⚡ Fast and lightweight

## Requirements

- Node.js v18 LTS or newer
- Linux-based system (tested on Raspberry Pi 3+)
- Google OAuth credentials
- 256MB RAM minimum

## Installation

### 1. Clone the Repository

```bash
git clone [https://github.com/yourusername/markdown-blog-system.git](https://github.com/netean/Database-Free-Website-.git)
cd Database-Free-Website
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and edit it with your settings:

```bash
cp .env.example .env
nano .env
```

Required environment variables:

- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `GOOGLE_CALLBACK_URL`: OAuth callback URL (e.g., `https://yourdomain.com/auth/google/callback`)
- `SESSION_SECRET`: Random string for session encryption (generate with `openssl rand -base64 32`)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (`development` or `production`)

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: Add your callback URL (e.g., `http://localhost:3000/auth/google/callback`)
5. Copy the Client ID and Client Secret to your `.env` file

### 5. Set Directory Permissions

Ensure the application has proper permissions:

```bash
# Set ownership (replace 'pi' with your username if different)
sudo chown -R pi:pi /path/to/markdown-blog-system

# Set directory permissions
chmod 755 content content/blog content/pages
chmod 755 themes themes/default
chmod 700 sessions
chmod 755 static static/admin
chmod 755 templates templates/admin

# Set file permissions
chmod 644 content/**/*.md
chmod 644 themes/**/*
chmod 644 static/**/*
chmod 644 templates/**/*
```

### 6. Create Initial Content

The system comes with sample content. You can add your own markdown files:

```bash
# Blog posts go in content/blog/
# Format: YYYY-MM-DD-title-slug.md
echo "---
title: My First Post
date: 2025-11-13
type: blog
order: 1
published: true
---

# My First Post

Welcome to my blog!" > content/blog/2025-11-13-my-first-post.md

# Pages go in content/pages/
echo "---
title: About
type: page
published: true
---

# About

This is my about page." > content/pages/about.md
```

## Running the Application

### Development Mode

```bash
npm start
```

### Production Mode (Raspberry Pi)

```bash
npm run start:pi
```

The application will be available at `http://localhost:3000` (or your configured port).

## Deployment

### Systemd Service (Recommended for Linux)

1. Copy the service file to systemd directory:

```bash
sudo cp markdown-blog.service /etc/systemd/system/
```

2. Edit the service file to match your setup:

```bash
sudo nano /etc/systemd/system/markdown-blog.service
```

Update these fields:
- `User`: Your username (default: `pi`)
- `Group`: Your group (default: `pi`)
- `WorkingDirectory`: Full path to your installation
- `EnvironmentFile`: Full path to your `.env` file

3. Reload systemd and enable the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable markdown-blog.service
sudo systemctl start markdown-blog.service
```

4. Check service status:

```bash
sudo systemctl status markdown-blog.service
```

5. View logs:

```bash
sudo journalctl -u markdown-blog.service -f
```

### Service Management Commands

```bash
# Start the service
sudo systemctl start markdown-blog.service

# Stop the service
sudo systemctl stop markdown-blog.service

# Restart the service
sudo systemctl restart markdown-blog.service

# Enable auto-start on boot
sudo systemctl enable markdown-blog.service

# Disable auto-start on boot
sudo systemctl disable markdown-blog.service

# View service status
sudo systemctl status markdown-blog.service

# View logs
sudo journalctl -u markdown-blog.service -n 50
```

### Reverse Proxy with Nginx (Optional)

For production deployment with HTTPS:

1. Install Nginx:

```bash
sudo apt-get update
sudo apt-get install nginx
```

2. Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/markdown-blog
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

3. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/markdown-blog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

4. Set up SSL with Let's Encrypt:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Usage

### Accessing the Admin Interface

1. Navigate to `http://yourdomain.com/login`
2. Click "Sign in with Google"
3. Authorize the application
4. You'll be redirected to the admin dashboard

### Creating Content

1. Log in to the admin interface
2. Click "Create New"
3. Fill in the form:
   - **Title**: Your content title
   - **Content**: Markdown content
   - **Type**: Blog or Page
4. Click "Create"

### Editing Content

1. From the admin dashboard, click "Edit" next to any content item
2. Modify the content
3. Click "Save Changes"

### Deleting Content

1. From the admin dashboard, click "Delete" next to any content item
2. Confirm the deletion in the dialog

### Reordering Content

1. From the admin dashboard, adjust the order numbers
2. Click "Save Order"

### Switching Themes

1. Navigate to Admin → Themes
2. Select a theme from the available options
3. Click "Activate"

### Adding Content via File System

You can also add/edit markdown files directly:

```bash
# Add a new blog post
nano content/blog/2025-11-13-new-post.md

# Add a new page
nano content/pages/contact.md
```

The system will automatically detect changes within 5 seconds and update the index.

## Directory Structure

```
markdown-blog-system/
├── content/              # Markdown content files
│   ├── blog/            # Blog posts
│   └── pages/           # Static pages
├── themes/              # Theme directories
│   └── default/         # Default theme
├── templates/           # Admin interface templates
│   └── admin/
├── static/              # Static assets
│   └── admin/
├── sessions/            # Session storage (auto-created)
├── server.js            # Main application entry point
├── config.js            # Configuration
├── auth.js              # Authentication logic
├── markdown-handler.js  # Markdown processing
├── content-indexer.js   # Content indexing and file watching
├── theme-manager.js     # Theme management
├── security.js          # Security utilities
└── .env                 # Environment variables (create from .env.example)
```

## Markdown Front Matter

All markdown files must include front matter:

### Blog Posts

```yaml
---
title: "Post Title"
date: 2025-11-13
type: blog
order: 1
published: true
tags: ["tag1", "tag2"]
---
```

### Pages

```yaml
---
title: "Page Title"
type: page
published: true
---
```

## Creating Custom Themes

1. Create a new directory in `themes/`:

```bash
mkdir themes/mytheme
```

2. Create required template files:
   - `layout.ejs` - Main layout
   - `blog-list.ejs` - Blog listing page
   - `blog-post.ejs` - Individual blog post
   - `page.ejs` - Static page
   - `404.ejs` - Error page
   - `styles.css` - Theme styles

3. Create `theme.json`:

```json
{
  "name": "My Theme",
  "version": "1.0.0",
  "templates": {
    "layout": "layout.ejs",
    "blogList": "blog-list.ejs",
    "blogPost": "blog-post.ejs",
    "page": "page.ejs",
    "404": "404.ejs"
  },
  "styles": ["styles.css"],
  "scripts": []
}
```

4. Activate via admin interface or manually edit `config/active-theme.json`

## Troubleshooting

### Service Won't Start

Check logs:
```bash
sudo journalctl -u markdown-blog.service -n 50
```

Common issues:
- Missing environment variables in `.env`
- Incorrect file permissions
- Port already in use
- Node.js not installed or wrong version

### Content Not Updating

- Check file permissions on `content/` directory
- Verify file watching is enabled (check logs)
- Restart the service: `sudo systemctl restart markdown-blog.service`

### Authentication Issues

- Verify Google OAuth credentials in `.env`
- Check callback URL matches Google Cloud Console settings
- Ensure `SESSION_SECRET` is set
- Check session directory permissions (should be 700)

### Performance Issues on Raspberry Pi

- Ensure you're using the `start:pi` script with memory limits
- Check system resources: `htop`
- Reduce number of active sessions
- Consider using a reverse proxy cache (Nginx)

### File Permission Errors

Reset permissions:
```bash
cd /path/to/markdown-blog-system
chmod 755 content content/blog content/pages themes static templates
chmod 700 sessions
chmod 644 content/**/*.md
```

## Performance Optimization

### Raspberry Pi Specific

- Use Node.js v18 LTS (best ARM optimization)
- Memory limit is set to 192MB in `start:pi` script
- EJS template caching is enabled in production
- File watching uses efficient chokidar (no polling)
- Session limit: 100 active sessions

### General Tips

- Enable Nginx caching for static assets
- Use HTTP/2 with Nginx
- Compress responses with gzip
- Minimize theme assets (CSS/JS)
- Keep content index under 1000 files for optimal performance

## Security Best Practices

1. **Always use HTTPS in production** (Let's Encrypt)
2. **Generate strong session secret**: `openssl rand -base64 32`
3. **Keep dependencies updated**: `npm audit fix`
4. **Restrict file permissions** as documented above
5. **Use firewall** to limit access: `sudo ufw allow 80,443/tcp`
6. **Regular backups** of content directory
7. **Monitor logs** for suspicious activity

## Backup and Restore

### Backup

```bash
# Backup content
tar -czf backup-content-$(date +%Y%m%d).tar.gz content/

# Backup themes (if customized)
tar -czf backup-themes-$(date +%Y%m%d).tar.gz themes/

# Backup configuration
cp .env .env.backup
```

### Restore

```bash
# Restore content
tar -xzf backup-content-20251113.tar.gz

# Restore themes
tar -xzf backup-themes-20251113.tar.gz

# Restore configuration
cp .env.backup .env
```

### Automated Backups

Add to crontab:
```bash
crontab -e
```

Add this line for daily backups at 2 AM:
```
0 2 * * * cd /home/pi/markdown-blog-system && tar -czf /home/pi/backups/content-$(date +\%Y\%m\%d).tar.gz content/
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/markdown-blog-system/issues
- Documentation: https://github.com/yourusername/markdown-blog-system/wiki

## Acknowledgments

Built with:
- [Express](https://expressjs.com/)
- [markdown-it](https://github.com/markdown-it/markdown-it)
- [Passport.js](http://www.passportjs.org/)
- [EJS](https://ejs.co/)
- [Chokidar](https://github.com/paulmillr/chokidar)
