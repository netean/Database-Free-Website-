# Design Document: Markdown Blog System

## Overview

The markdown blog system is a lightweight, file-based web application designed for resource-constrained Linux environments. The architecture prioritizes simplicity, using a non-MVC approach with inline handlers and code-behind patterns. The system uses Node.js with Express for the web server, markdown-it for rendering, and Google OAuth for authentication.

### Technology Stack

- **Runtime**: Node.js v18 LTS - excellent ARM optimization, good Raspberry Pi support
- **Web Framework**: Express - minimal, flexible, supports inline handlers and code-behind
- **Markdown Parser**: markdown-it with gray-matter for front-matter parsing
- **Authentication**: Passport.js with Google OAuth 2.0 strategy
- **Template Engine**: EJS - simple, supports inline code, minimal overhead
- **File Watching**: chokidar - efficient file system monitoring
- **Session Management**: express-session with session-file-store
- **Theme System**: Directory-based with EJS templates

### Design Principles

1. **Simplicity First**: Avoid over-engineering; use straightforward patterns
2. **File-Based Everything**: No database, all state in files
3. **Inline Logic**: Request handlers contain logic directly, no controller abstraction
4. **Resource Efficient**: Minimize memory usage and CPU overhead
5. **Linux Native**: Leverage Linux file system features

## Architecture

### High-Level Structure

```
markdown-blog-system/
├── server.js                 # Main entry point with inline route handlers
├── config.js                 # Configuration (OAuth, paths, etc.)
├── auth.js                   # Authentication setup (code-behind)
├── markdown-handler.js       # Markdown rendering logic (code-behind)
├── content-indexer.js        # File indexing and watching (code-behind)
├── theme-manager.js          # Theme loading and switching (code-behind)
├── package.json              # Node.js dependencies
├── content/                  # Markdown files storage
│   ├── blog/                 # Blog entries
│   └── pages/                # Static pages
├── themes/                   # Theme directories
│   ├── default/
│   │   ├── layout.html       # Main layout template
│   │   ├── blog-list.html    # Blog listing template
│   │   ├── blog-post.html    # Single post template
│   │   ├── page.html         # Page template
│   │   └── styles.css        # Theme styles
│   └── minimal/
├── templates/                # Admin interface templates
│   ├── admin/
│   │   ├── dashboard.html
│   │   ├── edit.html
│   │   ├── create.html
│   │   └── themes.html
│   └── login.html
├── sessions/                 # File-based session storage
└── static/                   # Static assets
    └── admin/                # Admin interface assets (CSS, JS)
```

### Request Flow

1. **Public Content Request**:
   - Request → Express Router → Markdown Handler → Theme Manager → Rendered HTML
   - Content Index provides metadata and file paths
   - Theme Manager applies active theme templates (EJS)

2. **Admin Request**:
   - Request → Auth Middleware → Admin Handler → EJS Template → Response
   - Session validation occurs at middleware level
   - Direct file operations for CRUD actions

3. **Authentication Flow**:
   - Login → Google OAuth (Passport.js) → Callback → Session Creation → Redirect to Admin

## Components and Interfaces

### 1. Content Indexer (`content-indexer.js`)

**Purpose**: Maintain an in-memory index of all markdown files with metadata and automatically detect external file changes.

**Interface**:
```javascript
class ContentIndexer {
  constructor(contentPath) {}
  
  // Initialize index by scanning content directory
  async initialize() {}
  
  // Get all blog entries sorted by order/date
  getBlogEntries() {}
  
  // Get all pages
  getPages() {}
  
  // Get single content item by slug
  getBySlug(slug) {}
  
  // Update index when file changes
  async reindex(filePath) {}
  
  // Remove file from index when deleted
  removeFromIndex(filePath) {}
  
  // Start watching for file changes (add, modify, delete)
  startWatching() {}
  
  // Stop watching (for cleanup)
  stopWatching() {}
}
```

**Data Structure**:
```javascript
{
  slug: 'my-blog-post',
  type: 'blog',  // or 'page'
  title: 'My Blog Post',
  date: '2025-11-12',
  order: 1,
  filePath: '/path/to/content/blog/my-blog-post.md',
  metadata: {}  // front matter object
}
```

**File Watching Behavior**:
- Uses `chokidar` to monitor the content directory for changes
- Detects three types of events:
  - **add**: New markdown file created → parse and add to index
  - **change**: Existing markdown file modified → reparse and update index
  - **unlink**: Markdown file deleted → remove from index
- Updates occur within 5 seconds of file system change (Requirement 10.3)
- Watching starts automatically when `startWatching()` is called during server initialization

**Design Rationale**: This satisfies Requirement 10 by ensuring that markdown files added, modified, or deleted outside the admin interface (e.g., via FTP, SSH, or direct file system access) are automatically reflected in the content index without requiring a server restart.

### 2. Markdown Handler (`markdown-handler.js`)

**Purpose**: Parse and render markdown files to HTML.

**Interface**:
```javascript
class MarkdownHandler {
  constructor() {}
  
  // Parse markdown file and extract front matter
  async parseFile(filePath) {}
  
  // Render markdown to HTML
  renderToHtml(markdownContent) {}
  
  // Validate markdown syntax (basic checks)
  validate(content) {}
}
```

**Front Matter Format**:
```yaml
---
title: "Post Title"
date: 2025-11-12
type: blog
order: 1
published: true
---
```

**Design Rationale**: Validation focuses on basic well-formedness checks (valid YAML front matter, no malformed markdown syntax) rather than comprehensive linting. This keeps the system lightweight while meeting Requirement 3.4 and 4.4.

### 3. Theme Manager (`theme-manager.js`)

**Purpose**: Load themes and apply them to rendered content.

**Interface**:
```javascript
class ThemeManager {
  constructor(themesPath, app) {}
  
  // Get list of available themes
  getAvailableThemes() {}
  
  // Get currently active theme
  getActiveTheme() {}
  
  // Switch to a different theme
  async setActiveTheme(themeName) {}
  
  // Render content with theme template
  async render(templateName, data, res) {}
  
  // Validate theme has required files
  validateTheme(themeName) {}
}
```

**Theme Configuration** (`theme.json` in each theme directory):
```json
{
  "name": "Default Theme",
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

**Design Rationale**: Each theme must include a 404.ejs template to satisfy Requirement 1.5 (themed 404 error pages). The theme manager validates this during theme switching and falls back to the default theme if required templates are missing (Requirement 7.5).

### 4. Authentication (`auth.js`)

**Purpose**: Handle Google OAuth and session management.

**Interface**:
```javascript
// Configure Passport.js with Google OAuth strategy
function configureAuth(app) {}

// Middleware to protect admin routes
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Logout handler
function logout(req, res) {
  req.logout(() => {
    res.redirect('/');
  });
}

module.exports = { configureAuth, requireAuth, logout };
```

**Configuration** (`config.js`):
```javascript
module.exports = {
  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
  
  // Session
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  sessionDir: './sessions',
  
  // Content
  contentPath: './content',
  blogDir: 'blog',
  pagesDir: 'pages',
  
  // Themes
  themesPath: './themes',
  defaultTheme: 'default',
  
  // Server
  port: process.env.PORT || 3000
};
```

### 5. Main Server (`server.js`)

**Purpose**: Bootstrap application and define inline route handlers.

**Key Routes**:

```javascript
// Public routes
app.get('/', handler_home)                    // Blog list
app.get('/page/:slug', handler_page)          // Static page
app.get('/blog/:slug', handler_blogPost)      // Blog post
app.get('/themes/:theme/*', handler_static)   // Theme assets

// Auth routes
app.get('/login', handler_login)
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
app.get('/auth/google/callback', handler_googleCallback)
app.get('/logout', handler_logout)

// Admin routes (all protected by requireAuth middleware)
app.get('/admin', requireAuth, handler_adminDashboard)
app.get('/admin/create', requireAuth, handler_adminCreate)
app.post('/admin/create', requireAuth, handler_adminCreatePost)
app.get('/admin/edit/:slug', requireAuth, handler_adminEdit)
app.post('/admin/edit/:slug', requireAuth, handler_adminEditPost)
app.delete('/admin/delete/:slug', requireAuth, handler_adminDelete)
app.post('/admin/reorder', requireAuth, handler_adminReorder)
app.get('/admin/themes', requireAuth, handler_adminThemes)
app.post('/admin/themes/activate', requireAuth, handler_adminThemesActivate)
```

**Inline Handler Examples**:

```javascript
// Public content handler
async function handler_blogPost(req, res) {
  try {
    const slug = req.params.slug;
    const contentItem = contentIndexer.getBySlug(slug);
    
    if (!contentItem || contentItem.type !== 'blog') {
      return await themeManager.render('404', { slug }, res);
    }
    
    const parsed = await markdownHandler.parseFile(contentItem.filePath);
    const html = markdownHandler.renderToHtml(parsed.content);
    
    await themeManager.render('blogPost', {
      title: parsed.metadata.title,
      date: parsed.metadata.date,
      content: html
    }, res);
  } catch (error) {
    console.error('Error rendering blog post:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Admin delete handler (expects client-side confirmation)
async function handler_adminDelete(req, res) {
  try {
    const slug = req.params.slug;
    const contentItem = contentIndexer.getBySlug(slug);
    
    if (!contentItem) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    // Delete file from filesystem
    await fs.unlink(contentItem.filePath);
    
    // Log deletion
    console.log(`[DELETE] ${contentItem.filePath} by ${req.user.email} at ${new Date().toISOString()}`);
    
    // Update index
    await contentIndexer.reindex(contentItem.filePath);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete content',
      message: error.message 
    });
  }
}
```

**Design Rationale**: 
- Delete handler uses DELETE HTTP method and returns JSON for AJAX-based confirmation dialogs (Requirement 5.1)
- 404 errors render themed templates (Requirement 1.5)
- All file operations log user and timestamp (Requirement 5.4)

### 6. Admin Interface Design

**Purpose**: Provide intuitive UI for content management operations.

**Dashboard Features**:
- List view of all blog entries and pages with metadata
- Quick actions: Edit, Delete, Reorder
- Create new content button
- Theme switcher

**Deletion Confirmation** (Requirement 5.1):
- Client-side JavaScript confirmation dialog before DELETE request
- Modal displays: "Are you sure you want to delete '[title]'? This action cannot be undone."
- Two buttons: "Cancel" (closes modal) and "Delete" (sends DELETE request)
- Success/error feedback via toast notifications

**Reordering Interface** (Requirement 6.1):
- Numeric input fields next to each content item for manual ordering
- "Save Order" button to submit changes via POST to `/admin/reorder`
- Alternative: Drag-and-drop using SortableJS library (optional enhancement)
- Visual feedback during reorder operation

**Reorder Persistence** (Requirement 6.3):
- Updates the `order` field in each markdown file's front matter
- Batch operation: updates multiple files in a single request
- Request payload: `{ items: [{ slug: 'post-1', order: 1 }, { slug: 'post-2', order: 2 }] }`
- Content indexer automatically detects file changes and updates in-memory index

**Design Rationale**: 
- Numeric ordering chosen over drag-and-drop as primary method for simplicity and accessibility
- Order stored in front matter (not separate index file) to keep content self-contained and portable
- Client-side confirmation prevents accidental deletions while keeping server logic simple

## Data Models

### Content Item (In-Memory Index)

```javascript
{
  slug: String,           // URL-friendly identifier
  type: String,           // 'blog' or 'page'
  title: String,          // Display title
  date: Date,             // Creation/publication date
  order: Number,          // User-defined ordering
  published: Boolean,     // Visibility flag
  filePath: String,       // Absolute path to markdown file
  metadata: Object        // All front matter fields
}
```

### Markdown File Structure

**Filename Generation** (Requirement 3.3):
- Blog entries: `YYYY-MM-DD-slugified-title.md` (e.g., `2025-11-12-my-first-post.md`)
- Pages: `slugified-title.md` (e.g., `about.md`)
- Slug generation: lowercase, replace spaces with hyphens, remove special characters
- Timestamp ensures uniqueness for blog entries

```markdown
---
title: "My First Blog Post"
date: 2025-11-12
type: blog
order: 1
published: true
tags: ["nodejs", "markdown"]
---

# My First Blog Post

This is the content of my blog post...
```

### Session Data

```javascript
{
  sessionId: String,
  user: {
    googleId: String,
    email: String,
    name: String,
    picture: String
  },
  createdAt: Date,
  expiresAt: Date
}
```

### Active Theme Configuration (File: `config/active-theme.json`)

```json
{
  "activeTheme": "default",
  "lastChanged": "2025-11-12T10:30:00Z",
  "changedBy": "user@example.com"
}
```

## Error Handling

### Strategy

1. **File System Errors**: Log and return 500, fallback to default content if possible
2. **Markdown Parse Errors**: Log and display error message in admin, show generic error to visitors
3. **Authentication Errors**: Redirect to login with error message
4. **Theme Errors**: Fall back to default theme, log warning
5. **Missing Content**: Return 404 with themed error page

### Error Response Format

```javascript
// For API-style admin endpoints
{
  success: false,
  error: {
    code: 'FILE_NOT_FOUND',
    message: 'The requested markdown file does not exist',
    details: { slug: 'missing-post' }
  }
}

// For rendered pages
// Use themed error templates (404.ejs, 500.ejs)
```

### Logging

- Use console logging with timestamps
- Log levels: ERROR, WARN, INFO
- Log file operations (create, update, delete)
- Log authentication events
- Log theme changes

## Testing Strategy

### Unit Testing

Focus on core logic modules:
- `content-indexer.js`: Test indexing, reindexing, file watching
- `markdown-handler.js`: Test parsing, rendering, validation
- `theme-manager.js`: Test theme loading, validation, switching

### Integration Testing

Test key workflows:
- Content creation flow (admin → file system → index update)
- Content rendering flow (request → index → markdown → theme → response)
- Authentication flow (login → OAuth → session → protected route)
- Theme switching flow (admin → config update → render with new theme)

### Manual Testing on Raspberry Pi

- Performance testing: Response times, memory usage
- File watching: Verify external file changes are detected (add/edit/delete markdown files via SSH)
- Concurrent access: Multiple users editing content
- Theme switching: Verify no caching issues
- External file additions: Add markdown files manually and verify they appear within 5 seconds

### Test Data

- Sample markdown files with various front matter configurations
- Multiple theme directories
- Mock Google OAuth responses for auth testing

## Performance Considerations

### Memory Optimization

- Keep content index in memory (estimated 1KB per file, 1000 files = 1MB)
- Cache rendered markdown HTML with TTL (5 minutes)
- Use streaming for large file operations
- Limit session storage to 100 active sessions

### CPU Optimization

- Parse markdown only when content changes
- Use efficient file watching (chokidar with polling disabled)
- Minimize template re-compilation (EJS caching enabled)

### Raspberry Pi Specific

- Use Node.js v18 LTS (good ARM optimization)
- Enable V8 snapshot for faster startup
- Use `--max-old-space-size=192` to limit heap
- Consider PM2 for process management and auto-restart

## Security Considerations

### Authentication

- Use HTTPS in production (reverse proxy with Let's Encrypt)
- Secure session cookies (httpOnly, secure, sameSite)
- Validate OAuth tokens
- Implement session timeout (24 hours)

### File Operations

- Validate file paths to prevent directory traversal
- Sanitize user input for filenames
- Restrict file operations to content directory
- Validate markdown content for XSS (markdown-it has built-in protection)

### Admin Access

- All admin routes protected by authentication middleware
- CSRF protection for state-changing operations
- Rate limiting on admin endpoints

## Deployment

### Environment Variables

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
SESSION_SECRET=random_secret_string
PORT=3000
NODE_ENV=production
```

### Systemd Service (Linux)

```ini
[Unit]
Description=Markdown Blog System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/markdown-blog
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Directory Permissions

- Content directory: Read/write for application user
- Themes directory: Read-only for application user
- Sessions directory: Read/write for application user, restricted permissions (700)

## Future Enhancements

- RSS feed generation
- Full-text search across content
- Image upload and management
- Markdown preview in editor
- Multi-user support with roles
- Content versioning/history
- Automated backups
