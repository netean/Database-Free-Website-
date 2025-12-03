const express = require('express');
const passport = require('passport');
const path = require('path');
const config = require('./config');
const { configureAuth, requireAuth, logout } = require('./auth');
const ContentIndexer = require('./content-indexer');
const MarkdownHandler = require('./markdown-handler');
const ThemeManager = require('./theme-manager');
const settingsManager = require('./settings-manager');
const { 
  validateFilePath, 
  sanitizeFilename, 
  csrfMiddleware, 
  verifyCsrfToken,
  isPathInContentDirectory 
} = require('./security');

// Initialize Express app
const app = express();

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure authentication (includes session middleware)
configureAuth(app);

// Add CSRF protection middleware for all routes
app.use(csrfMiddleware);

// Add global template variables middleware
app.use((req, res, next) => {
  res.locals.siteName = settingsManager.getSiteName();
  res.locals.footerText = settingsManager.getFooterText();
  res.locals.pages = contentIndexer.getPages();
  res.locals.user = req.user || null;
  next();
});

// Set EJS as template engine
app.set('view engine', 'ejs');

// Enable EJS template caching in production for better performance
if (process.env.NODE_ENV === 'production') {
  app.set('view cache', true);
  console.log('[INFO] EJS template caching enabled for production');
}

// Initialize core components
const contentIndexer = new ContentIndexer(config.contentPath);
const markdownHandler = new MarkdownHandler();
const themeManager = new ThemeManager(config.themesPath, app);

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * Home page - Display blog list
 */
async function handler_home(req, res) {
  try {
    const blogEntries = contentIndexer.getBlogEntries();
    const pages = contentIndexer.getPages();
    
    await themeManager.render('blogList', {
      title: 'Blog',
      entries: blogEntries,
      pages: pages,
      siteName: settingsManager.getSiteName(),
      user: req.user || null
    }, res);
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render home page:`, error.message);
    
    // Try to render themed 404 as fallback
    try {
      await themeManager.render('404', { 
        slug: 'home',
        user: req.user || null,
        error: 'Unable to load blog list'
      }, res.status(500));
    } catch (fallbackError) {
      console.error(`[ERROR] ${new Date().toISOString()} - Fallback render failed:`, fallbackError.message);
      res.status(500).send('Internal Server Error');
    }
  }
}

/**
 * Static page handler
 */
async function handler_page(req, res) {
  try {
    const slug = req.params.slug;
    const contentItem = contentIndexer.getBySlug(slug);
    const pages = contentIndexer.getPages();
    
    if (!contentItem || contentItem.type !== 'page') {
      console.log(`[INFO] ${new Date().toISOString()} - Page not found: ${slug}`);
      return await themeManager.render('404', { 
        slug,
        pages: pages,
        user: req.user || null
      }, res.status(404));
    }
    
    const parsed = await markdownHandler.parseFile(contentItem.filePath);
    const html = markdownHandler.renderToHtml(parsed.content);
    
    await themeManager.render('page', {
      title: parsed.metadata.title || contentItem.title,
      content: html,
      metadata: parsed.metadata,
      pages: pages,
      user: req.user || null
    }, res);
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render page ${req.params.slug}:`, error.message);
    
    // Try to render themed 404 as fallback
    try {
      await themeManager.render('404', { 
        slug: req.params.slug,
        user: req.user || null,
        error: 'Unable to load page'
      }, res.status(500));
    } catch (fallbackError) {
      console.error(`[ERROR] ${new Date().toISOString()} - Fallback render failed:`, fallbackError.message);
      res.status(500).send('Internal Server Error');
    }
  }
}

/**
 * Blog post handler
 */
async function handler_blogPost(req, res) {
  try {
    const slug = req.params.slug;
    const contentItem = contentIndexer.getBySlug(slug);
    const pages = contentIndexer.getPages();
    
    if (!contentItem || contentItem.type !== 'blog') {
      console.log(`[INFO] ${new Date().toISOString()} - Blog post not found: ${slug}`);
      return await themeManager.render('404', { 
        slug,
        pages: pages,
        user: req.user || null
      }, res.status(404));
    }
    
    const parsed = await markdownHandler.parseFile(contentItem.filePath);
    const html = markdownHandler.renderToHtml(parsed.content);
    
    await themeManager.render('blogPost', {
      title: parsed.metadata.title || contentItem.title,
      date: contentItem.date,
      content: html,
      metadata: parsed.metadata,
      pages: pages,
      user: req.user || null
    }, res);
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render blog post ${req.params.slug}:`, error.message);
    
    // Try to render themed 404 as fallback
    try {
      await themeManager.render('404', { 
        slug: req.params.slug,
        user: req.user || null,
        error: 'Unable to load blog post'
      }, res.status(500));
    } catch (fallbackError) {
      console.error(`[ERROR] ${new Date().toISOString()} - Fallback render failed:`, fallbackError.message);
      res.status(500).send('Internal Server Error');
    }
  }
}

/**
 * Serve theme static assets
 */
function handler_static(req, res) {
  try {
    const themeName = req.params.theme;
    const assetPath = req.params[0]; // Captures everything after theme name
    
    // Validate theme name to prevent directory traversal
    const sanitizedTheme = sanitizeFilename(themeName);
    if (sanitizedTheme !== themeName || themeName.includes('..') || themeName.includes('/')) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - Invalid theme name: ${themeName}`);
      return res.status(403).send('Forbidden');
    }
    
    // Validate asset path
    const validation = validateFilePath(assetPath, path.join(config.themesPath, themeName));
    if (!validation.valid) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - ${validation.error}: ${assetPath}`);
      return res.status(403).send('Forbidden');
    }
    
    res.sendFile(validation.sanitizedPath, (err) => {
      if (err) {
        console.error(`[ERROR] ${new Date().toISOString()} - Failed to serve static asset ${assetPath}:`, err.message);
        res.status(404).send('Asset not found');
      }
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Error in static asset handler:`, error.message);
    res.status(500).send('Internal Server Error');
  }
}

/**
 * Serve admin static assets
 */
function handler_adminStatic(req, res) {
  try {
    const assetPath = req.params[0]; // Captures everything after /static/admin/
    
    // Validate asset path to prevent directory traversal
    const validation = validateFilePath(assetPath, path.join(__dirname, 'static', 'admin'));
    if (!validation.valid) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - ${validation.error}: ${assetPath}`);
      return res.status(403).send('Forbidden');
    }
    
    res.sendFile(validation.sanitizedPath, (err) => {
      if (err) {
        console.error(`[ERROR] ${new Date().toISOString()} - Failed to serve admin static asset ${assetPath}:`, err.message);
        res.status(404).send('Asset not found');
      }
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Error in admin static asset handler:`, error.message);
    res.status(500).send('Internal Server Error');
  }
}

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * Login page handler
 */
function handler_login(req, res) {
  try {
    res.render(path.join(__dirname, 'templates', 'login.ejs'), {
      error: req.query.error || null
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render login page:`, error.message);
    res.status(500).send('Internal Server Error');
  }
}

/**
 * Google OAuth callback handler
 */
function handler_googleCallback(req, res) {
  try {
    console.log(`[INFO] ${new Date().toISOString()} - OAuth callback successful for user: ${req.user?.email || 'unknown'}`);
    // Redirect to admin dashboard after successful authentication
    res.redirect('/admin');
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - OAuth callback error:`, error.message);
    res.redirect('/login?error=callback_failed');
  }
}

/**
 * Logout handler
 */
function handler_logout(req, res) {
  try {
    logout(req, res);
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Logout error:`, error.message);
    res.status(500).send('Internal Server Error');
  }
}

// ============================================================================
// ROUTE DEFINITIONS
// ============================================================================

// Public routes
app.get('/', handler_home);
app.get('/page/:slug', handler_page);
app.get('/blog/:slug', handler_blogPost);
app.get('/themes/:theme/*', handler_static);
app.get('/static/admin/*', handler_adminStatic);

// Auth routes
app.get('/login', handler_login);
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }),
  handler_googleCallback
);
app.get('/logout', handler_logout);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * Admin dashboard - List all content items
 */
async function handler_adminDashboard(req, res) {
  try {
    const blogEntries = contentIndexer.getBlogEntries();
    const pages = contentIndexer.getPages();
    
    // Combine and sort all content items
    const allContent = [...blogEntries, ...pages];
    
    res.render(path.join(__dirname, 'templates', 'admin', 'dashboard.ejs'), {
      user: req.user,
      blogEntries: blogEntries,
      pages: pages,
      allContent: allContent
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render admin dashboard:`, error.message);
    res.status(500).send('Internal Server Error - Unable to load dashboard');
  }
}

/**
 * Display content creation form
 */
function handler_adminCreate(req, res) {
  try {
    res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
      user: req.user,
      error: null,
      formData: null
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render create form:`, error.message);
    res.status(500).send('Internal Server Error - Unable to load creation form');
  }
}

/**
 * Process content creation form submission
 */
async function handler_adminCreatePost(req, res) {
  const fs = require('fs').promises;
  
  try {
    const { title, content, type } = req.body;
    
    // Validate input
    if (!title || !content || !type) {
      return res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: 'All fields are required',
        formData: { title, content, type }
      });
    }
    
    if (!['blog', 'page'].includes(type)) {
      return res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: 'Invalid content type',
        formData: { title, content, type }
      });
    }
    
    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/-+/g, '-')            // Replace multiple hyphens with single
      .trim();
    
    if (!slug) {
      return res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: 'Title must contain at least one alphanumeric character',
        formData: { title, content, type }
      });
    }
    
    // Generate filename based on type
    let filename;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (type === 'blog') {
      // Blog entries: YYYY-MM-DD-slugified-title.md
      filename = `${dateStr}-${slug}.md`;
    } else {
      // Pages: slugified-title.md
      filename = `${slug}.md`;
    }
    
    // Sanitize filename for security
    filename = sanitizeFilename(filename);
    if (!filename.endsWith('.md')) {
      filename += '.md';
    }
    
    // Determine target directory
    const targetDir = type === 'blog' 
      ? path.join(config.contentPath, config.blogDir)
      : path.join(config.contentPath, config.pagesDir);
    
    const filePath = path.join(targetDir, filename);
    
    // Validate that the file path is within the content directory
    if (!isPathInContentDirectory(filePath, config.contentPath)) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - Attempted to create file outside content directory: ${filePath}`);
      return res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: 'Invalid file path',
        formData: { title, content, type }
      });
    }
    
    // Check if file already exists
    try {
      await fs.access(filePath);
      return res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: `A ${type} with this title already exists`,
        formData: { title, content, type }
      });
    } catch (err) {
      // File doesn't exist, which is what we want
    }
    
    // Create markdown content with front matter
    const frontMatter = {
      title: title,
      date: dateStr,
      type: type,
      published: true
    };
    
    // Add order field for blog entries (default to current timestamp for sorting)
    if (type === 'blog') {
      frontMatter.order = Date.now();
    }
    
    const markdownContent = `---
title: "${title}"
date: ${dateStr}
type: ${type}
${type === 'blog' ? `order: ${frontMatter.order}\n` : ''}published: true
---

${content}
`;
    
    // Validate markdown content before saving
    const validation = markdownHandler.validate(markdownContent);
    if (!validation.valid) {
      return res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: `Validation failed: ${validation.errors.join(', ')}`,
        formData: { title, content, type }
      });
    }
    
    // Write file to disk
    await fs.writeFile(filePath, markdownContent, 'utf8');
    
    // Log creation with timestamp and user
    console.log(`[CREATE] ${new Date().toISOString()} - File: ${filePath} - User: ${req.user.email}`);
    
    // Redirect to admin dashboard
    // The file watcher will automatically update the index
    res.redirect('/admin');
    
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to create content:`, error.message);
    
    try {
      res.render(path.join(__dirname, 'templates', 'admin', 'create.ejs'), {
        user: req.user,
        error: `Failed to create content: ${error.message}`,
        formData: req.body
      });
    } catch (renderError) {
      console.error(`[ERROR] ${new Date().toISOString()} - Failed to render error page:`, renderError.message);
      res.status(500).send('Internal Server Error - Unable to create content');
    }
  }
}

/**
 * Display content edit form with current content
 */
async function handler_adminEdit(req, res) {
  const fs = require('fs').promises;
  
  try {
    const slug = req.params.slug;
    
    // Get content item from index
    const contentItem = contentIndexer.getBySlug(slug);
    
    if (!contentItem) {
      console.log(`[INFO] ${new Date().toISOString()} - Edit requested for non-existent content: ${slug}`);
      return res.status(404).send('Content not found');
    }
    
    // Validate that the file path is within the content directory
    if (!isPathInContentDirectory(contentItem.filePath, config.contentPath)) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - Attempted to edit file outside content directory: ${contentItem.filePath}`);
      return res.status(403).send('Forbidden');
    }
    
    // Read the raw markdown file to get the content without front matter
    const parsed = await markdownHandler.parseFile(contentItem.filePath);
    
    res.render(path.join(__dirname, 'templates', 'admin', 'edit.ejs'), {
      user: req.user,
      contentItem: contentItem,
      rawContent: parsed.content,
      error: null
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render edit form for ${req.params.slug}:`, error.message);
    res.status(500).send('Internal Server Error - Unable to load edit form');
  }
}

/**
 * Process content edit form submission
 */
async function handler_adminEditPost(req, res) {
  const fs = require('fs').promises;
  
  try {
    const slug = req.params.slug;
    const { title, content, type } = req.body;
    
    // Get content item from index
    const contentItem = contentIndexer.getBySlug(slug);
    
    if (!contentItem) {
      return res.status(404).send('Content not found');
    }
    
    // Validate that the file path is within the content directory
    if (!isPathInContentDirectory(contentItem.filePath, config.contentPath)) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - Attempted to edit file outside content directory: ${contentItem.filePath}`);
      return res.status(403).send('Forbidden');
    }
    
    // Validate input
    if (!title || !content || !type) {
      const parsed = await markdownHandler.parseFile(contentItem.filePath);
      return res.render(path.join(__dirname, 'templates', 'admin', 'edit.ejs'), {
        user: req.user,
        contentItem: contentItem,
        rawContent: content || parsed.content,
        error: 'All fields are required'
      });
    }
    
    if (!['blog', 'page'].includes(type)) {
      const parsed = await markdownHandler.parseFile(contentItem.filePath);
      return res.render(path.join(__dirname, 'templates', 'admin', 'edit.ejs'), {
        user: req.user,
        contentItem: contentItem,
        rawContent: content,
        error: 'Invalid content type'
      });
    }
    
    // Preserve existing metadata
    const parsed = await markdownHandler.parseFile(contentItem.filePath);
    const existingMetadata = parsed.metadata;
    
    // Update metadata with new values
    const updatedMetadata = {
      ...existingMetadata,
      title: title,
      type: type
    };
    
    // Create updated markdown content with front matter
    const frontMatterLines = ['---'];
    
    // Add all metadata fields
    for (const [key, value] of Object.entries(updatedMetadata)) {
      if (typeof value === 'string') {
        // Escape quotes in string values
        const escapedValue = value.replace(/"/g, '\\"');
        frontMatterLines.push(`${key}: "${escapedValue}"`);
      } else if (value instanceof Date) {
        frontMatterLines.push(`${key}: ${value.toISOString().split('T')[0]}`);
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    
    frontMatterLines.push('---');
    frontMatterLines.push('');
    
    const markdownContent = frontMatterLines.join('\n') + content;
    
    // Validate markdown content before saving
    const validation = markdownHandler.validate(markdownContent);
    if (!validation.valid) {
      return res.render(path.join(__dirname, 'templates', 'admin', 'edit.ejs'), {
        user: req.user,
        contentItem: contentItem,
        rawContent: content,
        error: `Validation failed: ${validation.errors.join(', ')}`
      });
    }
    
    // Write updated content to the same file (preserving filename)
    await fs.writeFile(contentItem.filePath, markdownContent, 'utf8');
    
    // Log update with timestamp and user
    console.log(`[UPDATE] ${new Date().toISOString()} - File: ${contentItem.filePath} - User: ${req.user.email}`);
    
    // Redirect to admin dashboard
    // The file watcher will automatically update the index
    res.redirect('/admin');
    
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to update content ${req.params.slug}:`, error.message);
    
    // Try to render error with current content
    try {
      const contentItem = contentIndexer.getBySlug(req.params.slug);
      if (contentItem) {
        return res.render(path.join(__dirname, 'templates', 'admin', 'edit.ejs'), {
          user: req.user,
          contentItem: contentItem,
          rawContent: req.body.content || '',
          error: `Failed to update content: ${error.message}`
        });
      }
    } catch (renderError) {
      console.error(`[ERROR] ${new Date().toISOString()} - Failed to render error page:`, renderError.message);
    }
    
    res.status(500).send('Internal Server Error - Unable to update content');
  }
}

/**
 * Handle content deletion with confirmation
 */
async function handler_adminDelete(req, res) {
  const fs = require('fs').promises;
  
  try {
    const slug = req.params.slug;
    const contentItem = contentIndexer.getBySlug(slug);
    
    if (!contentItem) {
      console.log(`[INFO] ${new Date().toISOString()} - Delete requested for non-existent content: ${slug}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Content not found' 
      });
    }
    
    // Validate that the file path is within the content directory
    if (!isPathInContentDirectory(contentItem.filePath, config.contentPath)) {
      console.warn(`[SECURITY] ${new Date().toISOString()} - Attempted to delete file outside content directory: ${contentItem.filePath}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden'
      });
    }
    
    // Delete file from filesystem
    await fs.unlink(contentItem.filePath);
    
    // Log deletion with timestamp and user email
    console.log(`[DELETE] ${new Date().toISOString()} - File: ${contentItem.filePath} - User: ${req.user.email}`);
    
    // The file watcher will automatically update the index
    res.json({ 
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to delete content ${req.params.slug}:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete content',
      message: error.message 
    });
  }
}

/**
 * Handle batch order updates for content items
 */
async function handler_adminReorder(req, res) {
  const fs = require('fs').promises;
  
  try {
    const { items } = req.body;
    
    // Validate input
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: items array is required'
      });
    }
    
    // Process each item
    const updatePromises = items.map(async (item) => {
      const { slug, order } = item;
      
      // Get content item from index
      const contentItem = contentIndexer.getBySlug(slug);
      
      if (!contentItem) {
        console.warn(`[REORDER] Content not found: ${slug}`);
        return { slug, success: false, error: 'Content not found' };
      }
      
      // Validate that the file path is within the content directory
      if (!isPathInContentDirectory(contentItem.filePath, config.contentPath)) {
        console.warn(`[SECURITY] ${new Date().toISOString()} - Attempted to reorder file outside content directory: ${contentItem.filePath}`);
        return { slug, success: false, error: 'Forbidden' };
      }
      
      try {
        // Read the current file
        const fileContent = await fs.readFile(contentItem.filePath, 'utf8');
        
        // Parse the markdown file
        const parsed = await markdownHandler.parseFile(contentItem.filePath);
        
        // Update the order in metadata
        parsed.metadata.order = order;
        
        // Reconstruct the markdown file with updated front matter
        const frontMatterLines = ['---'];
        
        for (const [key, value] of Object.entries(parsed.metadata)) {
          if (typeof value === 'string') {
            // Escape quotes in string values
            const escapedValue = value.replace(/"/g, '\\"');
            frontMatterLines.push(`${key}: "${escapedValue}"`);
          } else if (value instanceof Date) {
            frontMatterLines.push(`${key}: ${value.toISOString().split('T')[0]}`);
          } else {
            frontMatterLines.push(`${key}: ${value}`);
          }
        }
        
        frontMatterLines.push('---');
        frontMatterLines.push('');
        
        const updatedContent = frontMatterLines.join('\n') + parsed.content;
        
        // Write the updated content back to the file
        await fs.writeFile(contentItem.filePath, updatedContent, 'utf8');
        
        console.log(`[REORDER] ${new Date().toISOString()} - Updated ${slug} to order ${order} - User: ${req.user.email}`);
        
        return { slug, success: true };
      } catch (error) {
        console.error(`[ERROR] ${new Date().toISOString()} - Failed to reorder ${slug}:`, error.message);
        return { slug, success: false, error: error.message };
      }
    });
    
    // Wait for all updates to complete
    const results = await Promise.all(updatePromises);
    
    // Check if any updates failed
    const failures = results.filter(r => !r.success);
    
    if (failures.length > 0) {
      return res.status(500).json({
        success: false,
        error: 'Some items failed to update',
        details: failures
      });
    }
    
    // The file watcher will automatically update the index
    res.json({
      success: true,
      message: 'Order updated successfully',
      updated: results.length
    });
    
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to update order:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: error.message
    });
  }
}

/**
 * Display theme management interface
 */
async function handler_adminThemes(req, res) {
  try {
    const availableThemes = await themeManager.getAvailableThemes();
    const activeTheme = await themeManager.getActiveTheme();
    
    res.render(path.join(__dirname, 'templates', 'admin', 'themes.ejs'), {
      user: req.user,
      availableThemes: availableThemes,
      activeTheme: activeTheme,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render themes page:`, error.message);
    res.status(500).send('Internal Server Error - Unable to load themes');
  }
}

/**
 * Activate a selected theme
 */
async function handler_adminThemesActivate(req, res) {
  try {
    const { themeName } = req.body;
    
    if (!themeName) {
      return res.redirect('/admin/themes?error=Theme name is required');
    }
    
    // Set the active theme
    const success = await themeManager.setActiveTheme(themeName, req.user.email);
    
    if (success) {
      res.redirect('/admin/themes?success=Theme activated successfully');
    } else {
      res.redirect('/admin/themes?error=Failed to activate theme');
    }
  } catch (error) {
    console.error('Error activating theme:', error);
    res.redirect('/admin/themes?error=Failed to activate theme');
  }
}

/**
 * Display settings page
 */
async function handler_adminSettings(req, res) {
  try {
    res.render(path.join(__dirname, 'templates', 'admin', 'settings.ejs'), {
      user: req.user,
      settings: {
        siteName: settingsManager.getSiteName(),
        footerText: settingsManager.getFooterText(),
        allowedUsers: settingsManager.getAllowedUsers()
      },
      message: req.query.message || null,
      messageType: req.query.type || 'success'
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to render settings page:`, error.message);
    res.status(500).send('Internal Server Error - Unable to load settings');
  }
}

/**
 * Update site settings
 */
async function handler_adminSettingsSite(req, res) {
  try {
    const { siteName, footerText } = req.body;
    
    if (!siteName || siteName.trim() === '') {
      return res.redirect('/admin/settings?type=error&message=Site name cannot be empty');
    }
    
    if (!footerText || footerText.trim() === '') {
      return res.redirect('/admin/settings?type=error&message=Footer text cannot be empty');
    }
    
    await settingsManager.setSiteName(siteName.trim());
    await settingsManager.setFooterText(footerText.trim());
    console.log(`[SETTINGS] ${new Date().toISOString()} - Site settings updated - User: ${req.user.email}`);
    
    res.redirect('/admin/settings?type=success&message=Site settings saved successfully');
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to save site settings:`, error.message);
    res.redirect('/admin/settings?type=error&message=Failed to save settings');
  }
}

/**
 * Update allowed users list
 */
async function handler_adminSettingsUsers(req, res) {
  try {
    const { allowedUsers } = req.body;
    
    // Parse the textarea input (one email per line)
    const userList = allowedUsers
      .split('\n')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = userList.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      return res.redirect(`/admin/settings?type=error&message=Invalid email addresses: ${invalidEmails.join(', ')}`);
    }
    
    await settingsManager.setAllowedUsers(userList);
    console.log(`[SETTINGS] ${new Date().toISOString()} - Allowed users updated - User: ${req.user.email}`);
    
    if (userList.length === 0) {
      res.redirect('/admin/settings?type=success&message=User restrictions removed - all authenticated users can access admin');
    } else {
      res.redirect('/admin/settings?type=success&message=Allowed users list updated successfully');
    }
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Failed to save user settings:`, error.message);
    res.redirect('/admin/settings?type=error&message=Failed to save user settings');
  }
}

// Admin routes (with CSRF protection for state-changing operations)
app.get('/admin', requireAuth, handler_adminDashboard);
app.get('/admin/create', requireAuth, handler_adminCreate);
app.post('/admin/create', requireAuth, verifyCsrfToken, handler_adminCreatePost);
app.get('/admin/edit/:slug', requireAuth, handler_adminEdit);
app.post('/admin/edit/:slug', requireAuth, verifyCsrfToken, handler_adminEditPost);
app.delete('/admin/delete/:slug', requireAuth, verifyCsrfToken, handler_adminDelete);
app.post('/admin/reorder', requireAuth, verifyCsrfToken, handler_adminReorder);
app.get('/admin/themes', requireAuth, handler_adminThemes);
app.post('/admin/themes/activate', requireAuth, verifyCsrfToken, handler_adminThemesActivate);
app.get('/admin/settings', requireAuth, handler_adminSettings);
app.post('/admin/settings/site', requireAuth, verifyCsrfToken, handler_adminSettingsSite);
app.post('/admin/settings/users', requireAuth, verifyCsrfToken, handler_adminSettingsUsers);

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Initialize server and start listening
 */
async function startServer() {
  const startTime = Date.now();
  
  try {
    console.log(`[INFO] ${new Date().toISOString()} - Server: Starting markdown blog system...`);
    
    // Load settings
    console.log(`[INFO] ${new Date().toISOString()} - Server: Loading settings...`);
    await settingsManager.load();
    
    // Initialize content indexer
    console.log(`[INFO] ${new Date().toISOString()} - Server: Initializing content indexer...`);
    await contentIndexer.initialize();
    
    // Start file watching
    console.log(`[INFO] ${new Date().toISOString()} - Server: Starting file watcher...`);
    contentIndexer.startWatching();
    
    // Initialize theme manager
    console.log(`[INFO] ${new Date().toISOString()} - Server: Initializing theme manager...`);
    const activeTheme = await themeManager.getActiveTheme();
    console.log(`[INFO] ${new Date().toISOString()} - Server: Active theme: ${activeTheme}`);
    
    // Start Express server
    const port = config.port;
    app.listen(port, () => {
      const startupTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[INFO] ${new Date().toISOString()} - Server: Running on http://localhost:${port}`);
      console.log(`[INFO] ${new Date().toISOString()} - Server: Startup complete in ${startupTime}s`);
    });
  } catch (error) {
    console.error(`[ERROR] ${new Date().toISOString()} - Server: Failed to start:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\n[INFO] ${new Date().toISOString()} - Server: Shutting down gracefully (SIGINT)...`);
  await contentIndexer.stopWatching();
  console.log(`[INFO] ${new Date().toISOString()} - Server: Shutdown complete`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\n[INFO] ${new Date().toISOString()} - Server: Shutting down gracefully (SIGTERM)...`);
  await contentIndexer.stopWatching();
  console.log(`[INFO] ${new Date().toISOString()} - Server: Shutdown complete`);
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`[ERROR] ${new Date().toISOString()} - Uncaught Exception:`, error.message);
  console.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[ERROR] ${new Date().toISOString()} - Unhandled Rejection at:`, promise);
  console.error('Reason:', reason);
});

// Start the server
startServer();
