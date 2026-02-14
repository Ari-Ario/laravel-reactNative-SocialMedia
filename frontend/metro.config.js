const { getDefaultConfig } = require('expo/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  const { resolver } = config;

  config.resolver = {
    ...resolver,
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'axios') {
        // Force browser ESM build to avoid Node/crypto imports
        const browserPath = require.resolve('axios/dist/esm/axios.js');
        return {
          filePath: browserPath,
          type: 'sourceFile',
        };
      }
      // Fallback for other modules
      return context.resolveRequest(context, moduleName, platform);
    },
  };

  return config;
})();