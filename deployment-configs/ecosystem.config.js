module.exports = {
  apps: [
    {
      name: 'capsystem-backend',
      script: './dist/index.js',
      cwd: '/var/www/capsystem/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Logging
      error_file: '/var/www/capsystem/logs/backend-error.log',
      out_file: '/var/www/capsystem/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful restart
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Auto-restart on crash with exponential backoff
      exp_backoff_restart_delay: 100,
    },
  ],
};
