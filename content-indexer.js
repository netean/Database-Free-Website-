const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const MarkdownHandler = require('./markdown-handler');

/**
 * ContentIndexer - Maintains an in-memory index of markdown files
 * Implements file watching to automatically detect external changes
 */
class ContentIndexer {
  constructor(contentPath) {
    this.contentPath = contentPath;
    this.markdownHandler = new MarkdownHandler();
    this.index = new Map(); // slug -> content item
    this.watcher = null;
  }

  /**
   * Initialize the index by scanning the content directory
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Initializing index from ${this.contentPath}`);
      
      // Scan blog directory
      const blogPath = path.join(this.contentPath, 'blog');
      await this._scanDirectory(blogPath, 'blog');
      
      // Scan pages directory
      const pagesPath = path.join(this.contentPath, 'pages');
      await this._scanDirectory(pagesPath, 'page');
      
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Index initialized with ${this.index.size} items`);
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ContentIndexer: Failed to initialize:`, error.message);
      throw error;
    }
  }

  /**
   * Scan a directory and add markdown files to the index
   * @private
   */
  async _scanDirectory(dirPath, type) {
    try {
      // Check if directory exists
      try {
        await fs.access(dirPath);
      } catch {
        console.warn(`[WARN] ${new Date().toISOString()} - ContentIndexer: Directory not found ${dirPath}`);
        return;
      }

      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(dirPath, file);
          await this._indexFile(filePath, type);
        }
      }
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ContentIndexer: Error scanning directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Index a single markdown file
   * @private
   */
  async _indexFile(filePath, type = null) {
    try {
      // Parse the markdown file
      const parsed = await this.markdownHandler.parseFile(filePath);
      
      // Generate slug from filename
      const filename = path.basename(filePath, '.md');
      const slug = this._generateSlug(filename);
      
      // Determine type from metadata or parameter
      const contentType = parsed.metadata.type || type || 'page';
      
      // Create content item
      const contentItem = {
        slug,
        type: contentType,
        title: parsed.metadata.title || filename,
        date: parsed.metadata.date ? new Date(parsed.metadata.date) : new Date(),
        order: parsed.metadata.order || 0,
        published: parsed.metadata.published !== false, // Default to true
        filePath,
        metadata: parsed.metadata
      };
      
      // Add to index
      this.index.set(slug, contentItem);
      
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Indexed ${slug} (${contentType})`);
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ContentIndexer: Failed to index ${filePath}:`, error.message);
    }
  }

  /**
   * Generate a URL-friendly slug from a filename
   * @private
   */
  _generateSlug(filename) {
    // Remove date prefix if present (YYYY-MM-DD-)
    let slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    
    // Convert to lowercase and replace spaces/special chars with hyphens
    slug = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    return slug;
  }

  /**
   * Get all blog entries sorted by order/date
   * @returns {Array} Sorted array of blog entries
   */
  getBlogEntries() {
    const blogEntries = Array.from(this.index.values())
      .filter(item => item.type === 'blog' && item.published);
    
    // Sort by order (ascending), then by date (descending)
    blogEntries.sort((a, b) => {
      // First sort by order
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Then by date (newest first)
      return b.date - a.date;
    });
    
    return blogEntries;
  }

  /**
   * Get all pages
   * @returns {Array} Array of page items sorted by order
   */
  getPages() {
    const pages = Array.from(this.index.values())
      .filter(item => item.type === 'page' && item.published);
    
    // Sort by order (ascending), then by date (descending)
    pages.sort((a, b) => {
      // First sort by order
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Then by date (newest first)
      return b.date - a.date;
    });
    
    return pages;
  }

  /**
   * Get a single content item by slug
   * @param {string} slug - The slug to look up
   * @returns {Object|null} Content item or null if not found
   */
  getBySlug(slug) {
    return this.index.get(slug) || null;
  }

  /**
   * Reindex a file (called when file is added or modified)
   * @param {string} filePath - Path to the file to reindex
   * @returns {Promise<void>}
   */
  async reindex(filePath) {
    try {
      // Determine type from directory
      const type = filePath.includes('/blog/') ? 'blog' : 'page';
      
      // Remove old entry if it exists
      const filename = path.basename(filePath, '.md');
      const slug = this._generateSlug(filename);
      
      if (this.index.has(slug)) {
        console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Reindexing ${slug}`);
      } else {
        console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Adding new file ${slug}`);
      }
      
      // Index the file
      await this._indexFile(filePath, type);
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ContentIndexer: Failed to reindex ${filePath}:`, error.message);
    }
  }

  /**
   * Remove a file from the index
   * @param {string} filePath - Path to the file to remove
   */
  removeFromIndex(filePath) {
    try {
      const filename = path.basename(filePath, '.md');
      const slug = this._generateSlug(filename);
      
      if (this.index.has(slug)) {
        this.index.delete(slug);
        console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Removed from index ${slug}`);
      }
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - ContentIndexer: Failed to remove ${filePath} from index:`, error.message);
    }
  }

  /**
   * Start watching the content directory for changes
   */
  startWatching() {
    if (this.watcher) {
      console.warn(`[WARN] ${new Date().toISOString()} - ContentIndexer: File watcher already running`);
      return;
    }

    console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Starting file watcher`);
    
    // Watch both blog and pages directories
    const watchPaths = [
      path.join(this.contentPath, 'blog', '*.md'),
      path.join(this.contentPath, 'pages', '*.md')
    ];

    this.watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true, // Don't trigger events for existing files
      usePolling: false, // Disable polling for efficient file watching on Linux
      awaitWriteFinish: {
        stabilityThreshold: 500, // Wait 500ms for file to finish writing
        pollInterval: 100
      }
    });

    // Handle file added
    this.watcher.on('add', async (filePath) => {
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: File added ${filePath}`);
      await this.reindex(filePath);
    });

    // Handle file changed
    this.watcher.on('change', async (filePath) => {
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: File changed ${filePath}`);
      await this.reindex(filePath);
    });

    // Handle file deleted
    this.watcher.on('unlink', (filePath) => {
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: File deleted ${filePath}`);
      this.removeFromIndex(filePath);
    });

    // Handle errors
    this.watcher.on('error', (error) => {
      console.error(`[ERROR] ${new Date().toISOString()} - ContentIndexer: Watcher error:`, error.message);
    });

    console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: File watcher started successfully`);
  }

  /**
   * Stop watching for file changes
   */
  async stopWatching() {
    if (this.watcher) {
      console.log(`[INFO] ${new Date().toISOString()} - ContentIndexer: Stopping file watcher`);
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = ContentIndexer;
