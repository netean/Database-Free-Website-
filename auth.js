const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const config = require('./config');
const settingsManager = require('./settings-manager');

/**
 * Configure Passport.js with Google OAuth strategy and session management
 * @param {Express.Application} app - Express application instance
 */
function configureAuth(app) {
  // Configure session middleware with file-based storage
  const fileStore = new FileStore({
    path: config.sessionDir,
    ttl: 86400, // 24 hours in seconds
    retries: 0,
    reapInterval: 3600, // Clean up expired sessions every hour
    fileExtension: '.json'
  });

  // Limit session storage to 100 active sessions for memory efficiency
  const fs = require('fs');
  const path = require('path');
  const originalSet = fileStore.set.bind(fileStore);
  
  fileStore.set = function(sid, session, callback) {
    // Count existing session files
    fs.readdir(config.sessionDir, (err, files) => {
      if (!err && files) {
        const sessionFiles = files.filter(f => f.endsWith('.json'));
        
        // If we have 100 or more sessions, remove the oldest one
        if (sessionFiles.length >= 100) {
          const sessionPaths = sessionFiles.map(f => ({
            file: f,
            path: path.join(config.sessionDir, f),
            mtime: fs.statSync(path.join(config.sessionDir, f)).mtime
          }));
          
          // Sort by modification time (oldest first)
          sessionPaths.sort((a, b) => a.mtime - b.mtime);
          
          // Remove the oldest session
          try {
            fs.unlinkSync(sessionPaths[0].path);
            console.log(`[INFO] ${new Date().toISOString()} - Session limit reached, removed oldest session: ${sessionPaths[0].file}`);
          } catch (unlinkErr) {
            console.error(`[ERROR] ${new Date().toISOString()} - Failed to remove old session:`, unlinkErr.message);
          }
        }
      }
      
      // Call original set method
      originalSet(sid, session, callback);
    });
  };

  app.use(session({
    store: fileStore,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId', // Custom session cookie name (don't use default 'connect.sid')
    cookie: {
      httpOnly: true, // Prevent client-side JavaScript access
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // Lax for OAuth compatibility (use 'strict' only if not using OAuth redirects)
      maxAge: 86400000 // 24 hours in milliseconds (session timeout)
    }
  }));

  // Initialize Passport and session support
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Google OAuth 2.0 strategy
  passport.use(new GoogleStrategy({
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: config.googleCallbackUrl
  },
  function(accessToken, refreshToken, profile, done) {
    // Extract user information from Google profile
    const user = {
      googleId: profile.id,
      email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
      name: profile.displayName,
      picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
    };
    
    // Check if user is allowed to access the admin
    if (!settingsManager.isUserAllowed(user.email)) {
      console.log(`[AUTH] ${new Date().toISOString()} - Access denied for user: ${user.email}`);
      return done(null, false, { message: 'Access denied. Your email is not authorized.' });
    }
    
    // Log authentication event
    console.log(`[AUTH] ${new Date().toISOString()} - User authenticated: ${user.email}`);
    
    return done(null, user);
  }));

  // Serialize user to session
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });
}

/**
 * Middleware to protect admin routes - requires authentication
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  
  // Log unauthorized access attempt
  console.log(`[AUTH] ${new Date().toISOString()} - Unauthorized access attempt to ${req.path}`);
  
  // Redirect to login page
  res.redirect('/login');
}

/**
 * Logout handler - ends user session
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 */
function logout(req, res) {
  const userEmail = req.user ? req.user.email : 'unknown';
  
  req.logout(function(err) {
    if (err) {
      console.error(`[ERROR] ${new Date().toISOString()} - Auth: Logout error for ${userEmail}:`, err.message);
      return res.status(500).send('Error logging out');
    }
    
    // Log logout event
    console.log(`[AUTH] ${new Date().toISOString()} - User logged out: ${userEmail}`);
    
    // Redirect to home page
    res.redirect('/');
  });
}

module.exports = {
  configureAuth,
  requireAuth,
  logout
};
