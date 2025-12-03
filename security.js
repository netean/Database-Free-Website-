const path = require('path');
const crypto = require('crypto');

/**
 * Security utilities for the markdown blog system
 */

/**
 * Validate and sanitize file paths to prevent directory traversal attacks
 * @param {string} userPath - User-provided path
 * @param {string} baseDir - Base directory to restrict operations to
 * @returns {Object} { valid: boolean, sanitizedPath: string|null, error: string|null }
 */
function validateFilePath(userPath, baseDir) {
  try {
    // Resolve the absolute path
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(baseDir, userPath);
    
    // Check if the resolved path is within the base directory
    if (!resolvedPath.startsWith(resolvedBase)) {
      return {
        valid: false,
        sanitizedPath: null,
        error: 'Path traversal detected: path must be within content directory'
      };
    }
    
    // Check for suspicious patterns
    if (userPath.includes('..') || userPath.includes('~')) {
      return {
        valid: false,
        sanitizedPath: null,
        error: 'Invalid path: contains suspicious characters'
      };
    }
    
    return {
      valid: true,
      sanitizedPath: resolvedPath,
      error: null
    };
  } catch (error) {
    return {
      valid: false,
      sanitizedPath: null,
      error: `Path validation error: ${error.message}`
    };
  }
}

/**
 * Sanitize filename to prevent malicious input
 * Removes special characters and path separators
 * @param {string} filename - User-provided filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  // Remove path separators and special characters
  // Allow only alphanumeric, hyphens, underscores, and dots
  let sanitized = filename
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '')    // Remove double dots
    .replace(/[^a-zA-Z0-9._-]/g, '-') // Replace special chars with hyphen
    .replace(/-+/g, '-')     // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 255);      // Limit length
  
  // Ensure filename doesn't start with a dot (hidden file)
  if (sanitized.startsWith('.')) {
    sanitized = sanitized.substring(1);
  }
  
  return sanitized || 'untitled';
}

/**
 * Generate a CSRF token
 * @returns {string} CSRF token
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to add CSRF token to session and locals
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function csrfMiddleware(req, res, next) {
  // Generate CSRF token if not present in session
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  
  // Make CSRF token available to templates
  res.locals.csrfToken = req.session.csrfToken;
  
  next();
}

/**
 * Middleware to verify CSRF token for state-changing operations
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function verifyCsrfToken(req, res, next) {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get token from request (body, query, or header)
  const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
  
  // Verify token matches session
  if (!token || token !== req.session.csrfToken) {
    console.warn(`[SECURITY] ${new Date().toISOString()} - CSRF token validation failed for ${req.path}`);
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }
  
  next();
}

/**
 * Validate that a file path is within the content directory
 * @param {string} filePath - File path to validate
 * @param {string} contentPath - Content directory path
 * @returns {boolean} True if path is valid and within content directory
 */
function isPathInContentDirectory(filePath, contentPath) {
  const resolvedContent = path.resolve(contentPath);
  const resolvedFile = path.resolve(filePath);
  
  return resolvedFile.startsWith(resolvedContent);
}

/**
 * Sanitize user input for display (prevent XSS)
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  validateFilePath,
  sanitizeFilename,
  generateCsrfToken,
  csrfMiddleware,
  verifyCsrfToken,
  isPathInContentDirectory,
  sanitizeInput
};
