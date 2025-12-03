# Implementation Plan

- [x] 1. Set up project structure and dependencies
  - Initialize Node.js project with package.json
  - Install core dependencies: express, ejs, markdown-it, gray-matter, chokidar, passport, passport-google-oauth20, express-session, session-file-store
  - Create directory structure: content/, themes/, sessions/, static/
  - Create config.js with environment variable configuration
  - _Requirements: 8.1, 8.3, 9.1_

- [x] 2. Implement markdown handler
  - [x] 2.1 Create markdown-handler.js with MarkdownHandler class
    - Implement parseFile() to read markdown files and extract front matter using gray-matter
    - Implement renderToHtml() using markdown-it to convert markdown to HTML
    - Implement validate() for basic front matter and markdown syntax checks
    - _Requirements: 1.1, 1.3, 3.4, 4.4_

- [x] 3. Implement content indexer with file watching
  - [x] 3.1 Create content-indexer.js with ContentIndexer class
    - Implement initialize() to scan content directory and build in-memory index
    - Implement getBlogEntries() to return sorted blog entries by order/date
    - Implement getPages() to return all pages
    - Implement getBySlug() for single content item lookup
    - _Requirements: 1.2, 10.1, 10.4, 10.5_
  
  - [x] 3.2 Add file watching capabilities
    - Implement startWatching() using chokidar to monitor content directory
    - Handle 'add' event to index new markdown files
    - Handle 'change' event to reindex modified files
    - Handle 'unlink' event to remove deleted files from index
    - Ensure updates occur within 5 seconds of file system changes
    - _Requirements: 10.2, 10.3_

- [x] 4. Implement theme manager
  - [x] 4.1 Create theme-manager.js with ThemeManager class
    - Implement getAvailableThemes() to scan themes directory
    - Implement getActiveTheme() to read active theme from config file
    - Implement setActiveTheme() to update active theme configuration
    - Implement validateTheme() to check for required template files (including 404.ejs)
    - Implement render() to render content using EJS templates from active theme
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 1.5_

- [x] 5. Implement authentication
  - [x] 5.1 Create auth.js with Google OAuth setup
    - Implement configureAuth() to set up Passport.js with Google OAuth strategy
    - Configure express-session with session-file-store
    - Implement requireAuth middleware to protect admin routes
    - Implement logout() handler
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.5_

- [x] 6. Create main server with public routes
  - [x] 6.1 Create server.js with Express app initialization
    - Set up middleware: body-parser, express-session, passport
    - Initialize ContentIndexer, MarkdownHandler, and ThemeManager
    - Start file watching on server startup
    - _Requirements: 8.4, 9.1_
  
  - [x] 6.2 Implement public content routes
    - Implement handler_home() to display blog list
    - Implement handler_page() to render static pages
    - Implement handler_blogPost() to render individual blog posts
    - Implement handler_static() to serve theme assets
    - Return themed 404 page for missing content
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 8.5_

- [x] 7. Implement authentication routes
  - [x] 7.1 Add login and OAuth routes
    - Implement handler_login() to display login page
    - Add /auth/google route with Passport.js authentication
    - Implement handler_googleCallback() to handle OAuth callback
    - Implement handler_logout() to end session
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 8. Implement admin dashboard
  - [x] 8.1 Create admin dashboard route and template
    - Implement handler_adminDashboard() to list all content items
    - Create templates/admin/dashboard.ejs with content list
    - Display title, type, date, order for each item
    - Add quick action buttons: Edit, Delete
    - Add "Create New" button
    - _Requirements: 3.1, 4.1, 5.1, 6.1_

- [-] 9. Implement content creation
  - [x] 9.1 Add content creation routes
    - Implement handler_adminCreate() to display creation form
    - Create templates/admin/create.ejs with form fields (title, content, type)
    - Implement handler_adminCreatePost() to process form submission
    - Generate unique filename based on title and timestamp for blog entries
    - Create markdown file with front matter in content directory
    - Validate markdown content before saving
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 10. Implement content editing
  - [x] 10.1 Add content editing routes
    - Implement handler_adminEdit() to display edit form with current content
    - Create templates/admin/edit.ejs with pre-filled form fields
    - Implement handler_adminEditPost() to process edit submission
    - Update markdown file while preserving original filename
    - Validate markdown content before saving
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 11. Implement content deletion
  - [x] 11.1 Add deletion functionality with confirmation
    - Implement handler_adminDelete() to handle DELETE requests
    - Add client-side JavaScript for confirmation dialog
    - Display modal: "Are you sure you want to delete '[title]'?"
    - Delete markdown file from filesystem on confirmation
    - Log deletion with timestamp and user email
    - Return error message if deletion fails
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 12. Implement content reordering
  - [x] 12.1 Add reordering interface and handler
    - Add numeric input fields to dashboard for manual ordering
    - Add "Save Order" button
    - Implement handler_adminReorder() to process batch order updates
    - Update order field in markdown front matter for affected files
    - Display items according to user-defined order on public pages
    - Provide default ordering by creation date for new content
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Implement theme switching
  - [x] 13.1 Add theme management interface
    - Implement handler_adminThemes() to display theme selector
    - Create templates/admin/themes.ejs showing available themes
    - Implement handler_adminThemesActivate() to switch active theme
    - Update active theme configuration file
    - Apply new theme immediately without server restart
    - Fall back to default theme if selected theme is invalid
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 14. Create default theme
  - [x] 14.1 Build default theme templates and assets
    - Create themes/default/ directory with theme.json configuration
    - Create layout.ejs as main layout template
    - Create blog-list.ejs for blog listing page
    - Create blog-post.ejs for individual blog posts
    - Create page.ejs for static pages
    - Create 404.ejs for error pages
    - Create styles.css with basic styling
    - _Requirements: 1.1, 1.5, 7.1_

- [x] 15. Add admin interface styling
  - [x] 15.1 Create admin templates and assets
    - Create templates/login.ejs for login page
    - Create static/admin/admin.css for admin interface styling
    - Add static/admin/admin.js for client-side interactions (delete confirmation, reordering)
    - Ensure responsive design for mobile access
    - _Requirements: 2.1, 5.1, 6.1_

- [x] 16. Implement error handling and logging
  - [x] 16.1 Add comprehensive error handling
    - Add try-catch blocks to all route handlers
    - Return themed 404 pages for missing content
    - Return 500 errors with generic messages for server errors
    - Log all file operations (create, update, delete) with timestamps
    - Log authentication events
    - Log theme changes
    - _Requirements: 5.4, 5.5_

- [x] 17. Optimize for Raspberry Pi
  - [x] 17.1 Add performance optimizations
    - Configure Node.js with --max-old-space-size=192 flag
    - Enable EJS template caching in production
    - Disable chokidar polling for efficient file watching
    - Limit session storage to 100 active sessions
    - Add startup time logging to verify <10 second requirement
    - _Requirements: 8.2, 8.4, 8.5_

- [x] 18. Add security measures
  - [x] 18.1 Implement security best practices
    - Configure secure session cookies (httpOnly, secure, sameSite)
    - Validate file paths to prevent directory traversal
    - Sanitize user input for filenames
    - Restrict file operations to content directory only
    - Add CSRF protection for state-changing operations
    - Configure session timeout (24 hours)
    - _Requirements: 2.4, 2.5_

- [x] 19. Create deployment configuration
  - [x] 19.1 Add deployment files and documentation
    - Create .env.example with required environment variables
    - Create systemd service file for Linux deployment
    - Document directory permissions requirements
    - Create README.md with setup and deployment instructions
    - _Requirements: 8.1_
