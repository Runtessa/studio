const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  allowedDevOrigins: [
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://192.168.24.1:3002",
  ],
  experimental: {
    optimizeCss: false,
    serverSourceMaps: true
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev && config.optimization) {
      config.optimization.minimize = false;
    }
    return config;
  }
};

export default nextConfig;
