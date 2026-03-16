/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.yad2.co.il" },
      { protocol: "https", hostname: "**.madlan.co.il" },
      { protocol: "https", hostname: "**.fbcdn.net" },
    ],
  },
};

module.exports = nextConfig;
