const fs = require('fs').promises;
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

/**
 * MarkdownHandler - Handles parsing and rendering of markdown files
 * Implements inline code-behind pattern for markdown operations
 */
class MarkdownHandler {
  constructor() {
    // Initialize markdown-it with safe defaults
    this.md = new MarkdownIt({
      html: false,        // Disable HTML tags for security
      xhtmlOut: true,     // Use XHTML-style tags
      breaks: true,       // Convert line breaks to <br>
      linkify: true,      // Auto-convert URLs to links
      typographer: true   // Enable smart quotes and other typographic replacements
    });
  }

  /**
   * Parse a markdown file and extract front matter
   * @param {string} filePath - Absolute path to the markdown file
   * @returns {Promise<{metadata: Object, content: string}>} Parsed front matter and content
   * @throws {Error} If file cannot be read or parsed
   */
  async parseFile(filePath) {
    try {
      // Read file content
      const fileContent = await fs.readFile(filePath, 'utf8');
      
      // Parse front matter using gray-matter
      const parsed = matter(fileContent);
      
      return {
        metadata: parsed.data,      // Front matter as object
        content: parsed.content     // Markdown content without front matter
      };
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - MarkdownHandler: Failed to parse file ${filePath}:`, error.message);
      throw new Error(`Failed to parse markdown file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Render markdown content to HTML
   * @param {string} markdownContent - Raw markdown text
   * @returns {string} Rendered HTML
   */
  renderToHtml(markdownContent) {
    try {
      return this.md.render(markdownContent);
    } catch (error) {
      console.error(`[ERROR] ${new Date().toISOString()} - MarkdownHandler: Failed to render markdown:`, error.message);
      throw new Error(`Failed to render markdown to HTML: ${error.message}`);
    }
  }

  /**
   * Validate markdown content for basic well-formedness
   * Checks for valid YAML front matter and basic markdown syntax
   * @param {string} content - Full markdown file content (with front matter)
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate(content) {
    const errors = [];

    try {
      // Check if content is empty
      if (!content || content.trim().length === 0) {
        errors.push('Content is empty');
        return { valid: false, errors };
      }

      // Try to parse front matter
      let parsed;
      try {
        parsed = matter(content);
      } catch (error) {
        errors.push(`Invalid front matter YAML: ${error.message}`);
        return { valid: false, errors };
      }

      // Validate front matter has required fields
      if (!parsed.data || Object.keys(parsed.data).length === 0) {
        errors.push('Front matter is missing or empty');
      }

      // Check for required front matter fields
      if (!parsed.data.title || typeof parsed.data.title !== 'string') {
        errors.push('Front matter must include a "title" field');
      }

      if (!parsed.data.type || !['blog', 'page'].includes(parsed.data.type)) {
        errors.push('Front matter must include a "type" field with value "blog" or "page"');
      }

      // Check if markdown content exists after front matter
      if (!parsed.content || parsed.content.trim().length === 0) {
        errors.push('Markdown content is empty');
      }

      // Try to render markdown to catch syntax errors
      try {
        this.md.render(parsed.content);
      } catch (error) {
        errors.push(`Markdown syntax error: ${error.message}`);
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors };
    }
  }
}

module.exports = MarkdownHandler;
