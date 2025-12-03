const fs = require('fs').promises;
const path = require('path');

/**
 * ThemeManager handles theme loading, validation, and rendering
 * Manages theme switching and applies EJS templates from the active theme
 */
class ThemeManager {
  constructor(themesPath, app) {
    this.themesPath = themesPath;
    this.app = app;
    this.activeThemeConfigPath = path.join(process.cwd(), 'config', 'active-theme.json');
    this.activeTheme = null;
  }

  /**
   * Get list of available themes by scanning themes directory
   * @returns {Promise<Array<Object>>} Array of theme objects with name and config
   */
  async getAvailableThemes() {
    try {
      const entries = await fs.readdir(this.themesPath, { withFileTypes: true });
      const themes = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const themePath = path.join(this.themesPath, entry.name);
          const configPath = path.join(themePath, 'theme.json');
          
          try {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            themes.push({
              name: entry.name,
              displayName: config.name || entry.name,
              version: config.version || '1.0.0',
              config: config
            });
          } catch (error) {
            // Theme doesn't have valid theme.json, skip it
            console.warn(`[WARN] ${new Date().toISOString()} - Theme ${entry.name} has invalid or missing theme.json:`, error.message);
          }
        }
      }

      return themes;
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - Failed to read themes directory:`, error.message);
      return [];
    }
  }

  /**
   * Get currently active theme name
   * @returns {Promise<string>} Active theme name
   */
  async getActiveTheme() {
    if (this.activeTheme) {
      return this.activeTheme;
    }

    try {
      const configContent = await fs.readFile(this.activeThemeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      this.activeTheme = config.activeTheme;
      return this.activeTheme;
    } catch (error) {
      // Config file doesn't exist or is invalid, use default theme
      const config = require('./config');
      this.activeTheme = config.defaultTheme;
      return this.activeTheme;
    }
  }

  /**
   * Switch to a different theme
   * @param {string} themeName - Name of theme to activate
   * @param {string} userEmail - Email of user making the change (for logging)
   * @returns {Promise<boolean>} Success status
   */
  async setActiveTheme(themeName, userEmail = 'system') {
    // Validate theme exists and has required files
    const isValid = await this.validateTheme(themeName);
    
    if (!isValid) {
      console.warn(`[WARN] ${new Date().toISOString()} - Theme ${themeName} is invalid, falling back to default`);
      const config = require('./config');
      themeName = config.defaultTheme;
    }

    // Update active theme configuration
    const configData = {
      activeTheme: themeName,
      lastChanged: new Date().toISOString(),
      changedBy: userEmail
    };

    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.activeThemeConfigPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Write config file
      await fs.writeFile(
        this.activeThemeConfigPath,
        JSON.stringify(configData, null, 2),
        'utf-8'
      );

      // Update in-memory cache
      this.activeTheme = themeName;

      // Update Express view path to use new theme
      const themePath = path.join(this.themesPath, themeName);
      this.app.set('views', themePath);

      console.log(`[THEME] ${configData.lastChanged} - Switched to ${themeName} - User: ${userEmail}`);
      
      return true;
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - Failed to set active theme ${themeName}:`, error.message);
      return false;
    }
  }

  /**
   * Validate theme has all required template files
   * @param {string} themeName - Name of theme to validate
   * @returns {Promise<boolean>} True if theme is valid
   */
  async validateTheme(themeName) {
    const themePath = path.join(this.themesPath, themeName);
    
    // Required template files (including 404.ejs per Requirement 1.5)
    const requiredTemplates = [
      'layout.ejs',
      'blog-list.ejs',
      'blog-post.ejs',
      'page.ejs',
      '404.ejs'
    ];

    try {
      // Check if theme directory exists
      await fs.access(themePath);

      // Check for theme.json
      const configPath = path.join(themePath, 'theme.json');
      await fs.access(configPath);

      // Check all required templates exist
      for (const template of requiredTemplates) {
        const templatePath = path.join(themePath, template);
        try {
          await fs.access(templatePath);
        } catch (error) {
          console.warn(`[WARN] ${new Date().toISOString()} - Theme ${themeName} missing required template: ${template}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(`[WARN] ${new Date().toISOString()} - Theme ${themeName} validation failed:`, error.message);
      return false;
    }
  }

  /**
   * Render content using EJS templates from active theme
   * @param {string} templateName - Name of template to use (without .ejs extension)
   * @param {Object} data - Data to pass to template
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async render(templateName, data, res) {
    try {
      const activeTheme = await this.getActiveTheme();
      const themePath = path.join(this.themesPath, activeTheme);
      
      // Set views directory to active theme
      this.app.set('views', themePath);
      
      // Map template names to actual files
      const templateMap = {
        'blogList': 'blog-list.ejs',
        'blogPost': 'blog-post.ejs',
        'page': 'page.ejs',
        '404': '404.ejs',
        'layout': 'layout.ejs'
      };

      const templateFile = templateMap[templateName] || `${templateName}.ejs`;
      
      // Render template
      res.render(templateFile, data);
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - Failed to render template ${templateName}:`, error.message);
      
      // Fallback to default theme on error
      const config = require('./config');
      const defaultThemePath = path.join(this.themesPath, config.defaultTheme);
      this.app.set('views', defaultThemePath);
      
      try {
        console.log(`[INFO] ${new Date().toISOString()} - Attempting fallback render with default theme`);
        res.status(500).render('404.ejs', { 
          error: 'Template rendering error',
          ...data 
        });
      } catch (fallbackError) {
        console.error(`[ERROR] ${new Date().toISOString()} - Fallback render failed:`, fallbackError.message);
        res.status(500).send('Internal Server Error');
      }
    }
  }
}

module.exports = ThemeManager;
