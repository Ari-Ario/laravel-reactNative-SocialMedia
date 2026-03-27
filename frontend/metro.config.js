// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for import.meta
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: false,
      // Keep import.meta
      keep_infinity: true,
    },
  },
};

module.exports = config;
