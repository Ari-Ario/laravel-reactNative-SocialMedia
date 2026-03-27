module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {
        jsxImportSource: 'react',
      }]
    ],
    plugins: [
      // Transform import.meta first
      'babel-plugin-transform-import-meta',
      // Reanimated must be last
      'react-native-reanimated/plugin',
    ],
    assumptions: {
      // Helps with import.meta transformation
      setPublicClassFields: true,
    },
  };
};
