module.exports = {
  apps: [
    {
      name: 'ludora-api-dev',
      script: 'index.js',
      cwd: '/Users/omri/omri-dev/base44/ludora/ludora-api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ENVIRONMENT: 'development',
        NODE_ENV: 'development'
      },
      env_staging: {
        ENVIRONMENT: 'staging',
        NODE_ENV: 'staging'
      },
      env_production: {
        ENVIRONMENT: 'production',
        NODE_ENV: 'production'
      },
      // Log management configuration
      log_file: './logs/pm2-combined-0.log',
      out_file: './logs/pm2-out-0.log',
      error_file: './logs/pm2-error-0.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Process management
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // Development specific settings
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Restart configuration
      min_uptime: '10s',
      max_restarts: 10,
      
      // Source map support for better error reporting
      source_map_support: true
    },
    {
      name: 'ludora-api-staging',
      script: 'index.js',
      cwd: '/Users/omri/omri-dev/base44/ludora/ludora-api',
      instances: 1,
      exec_mode: 'fork',
      env: {
        ENVIRONMENT: 'staging',
        NODE_ENV: 'staging'
      },
      // Log management for staging
      log_file: './logs/staging-combined.log',
      out_file: './logs/staging-out.log',
      error_file: './logs/staging-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Production-like settings
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      min_uptime: '30s',
      max_restarts: 5
    },
    {
      name: 'ludora-api-prod',
      script: 'index.js',
      cwd: '/Users/omri/omri-dev/base44/ludora/ludora-api',
      instances: 2, // Load balance with 2 instances
      exec_mode: 'cluster',
      env: {
        ENVIRONMENT: 'production',
        NODE_ENV: 'production'
      },
      // Production log management
      log_file: './logs/production-combined.log',
      out_file: './logs/production-out.log',
      error_file: './logs/production-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Production settings
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      
      // More conservative restart policy for production
      min_uptime: '60s',
      max_restarts: 3,
      
      // Enable performance monitoring in production
      pmx: true,
      
      // Graceful shutdown
      kill_timeout: 5000
    }
  ]
};