const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Add support for import.meta and web extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'web.js', 'web.jsx', 'web.ts', 'web.tsx'];

module.exports = config;
