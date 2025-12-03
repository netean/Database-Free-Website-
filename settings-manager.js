const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, 'config', 'site-settings.json');

/**
 * Settings Manager - Handles site configuration
 */
class SettingsManager {
  constructor() {
    this.settings = {
      siteName: 'My Blog',
      footerText: 'Powered by Markdown',
      allowedUsers: []
    };
    this.loaded = false;
  }

  /**
   * Load settings from file
   */
  async load() {
    try {
      const data = await fs.readFile(SETTINGS_FILE, 'utf8');
      this.settings = JSON.parse(data);
      this.loaded = true;
      console.log(`[INFO] ${new Date().toISOString()} - Settings loaded`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create it with defaults
        await this.save();
        console.log(`[INFO] ${new Date().toISOString()} - Created default settings file`);
      } else {
        console.error(`[ERROR] ${new Date().toISOString()} - Failed to load settings:`, error.message);
      }
    }
  }

  /**
   * Save settings to file
   */
  async save() {
    try {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
      console.log(`[INFO] ${new Date().toISOString()} - Settings saved`);
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - Failed to save settings:`, error.message);
      throw error;
    }
  }

  /**
   * Get site name
   */
  getSiteName() {
    return this.settings.siteName || 'My Blog';
  }

  /**
   * Set site name
   */
  async setSiteName(name) {
    this.settings.siteName = name;
    await this.save();
  }

  /**
   * Get footer text
   */
  getFooterText() {
    return this.settings.footerText || 'Powered by Markdown';
  }

  /**
   * Set footer text
   */
  async setFooterText(text) {
    this.settings.footerText = text;
    await this.save();
  }

  /**
   * Get allowed users list
   */
  getAllowedUsers() {
    return this.settings.allowedUsers || [];
  }

  /**
   * Check if user is allowed (empty list = all users allowed)
   */
  isUserAllowed(email) {
    const allowedUsers = this.getAllowedUsers();
    // If no restrictions, allow all users
    if (!allowedUsers || allowedUsers.length === 0) {
      return true;
    }
    // Check if user email is in allowed list
    return allowedUsers.includes(email);
  }

  /**
   * Add allowed user
   */
  async addAllowedUser(email) {
    if (!this.settings.allowedUsers) {
      this.settings.allowedUsers = [];
    }
    if (!this.settings.allowedUsers.includes(email)) {
      this.settings.allowedUsers.push(email);
      await this.save();
    }
  }

  /**
   * Remove allowed user
   */
  async removeAllowedUser(email) {
    if (this.settings.allowedUsers) {
      this.settings.allowedUsers = this.settings.allowedUsers.filter(u => u !== email);
      await this.save();
    }
  }

  /**
   * Set allowed users list
   */
  async setAllowedUsers(users) {
    this.settings.allowedUsers = users;
    await this.save();
  }
}

// Export singleton instance
module.exports = new SettingsManager();
