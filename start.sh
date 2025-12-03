#!/bin/bash
# Startup script for Markdown Blog System optimized for Raspberry Pi
# This script configures Node.js with memory limits suitable for resource-constrained environments

# Set Node.js memory limit to 192MB for Raspberry Pi optimization
export NODE_OPTIONS="--max-old-space-size=192"

# Set production environment if not already set
if [ -z "$NODE_ENV" ]; then
  export NODE_ENV=production
fi

echo "Starting Markdown Blog System with optimized settings for Raspberry Pi..."
echo "Node.js memory limit: 192MB"
echo "Environment: $NODE_ENV"

# Start the server
node server.js
