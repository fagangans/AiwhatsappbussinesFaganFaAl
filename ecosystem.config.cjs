module.exports = {
  apps: [
    {
      name: "wa-business-cs",
      script: "LenwySet.js",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
