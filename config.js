// Load environment variables from .env file
require('dotenv').config();

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
