module.exports = {
  apps: [
    {
      name: "urbanmotion-ai-api",
      cwd: "/var/www/urbanmotion-ai/backend",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3001
      },
      error_file: "/var/log/urbanmotion-ai/api-error.log",
      out_file: "/var/log/urbanmotion-ai/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      max_memory_restart: "512M"
    }
  ]
};
