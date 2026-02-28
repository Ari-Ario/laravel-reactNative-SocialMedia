module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            'babel-plugin-transform-import-meta',
            'react-native-reanimated/plugin', // Required for Reanimated
        ],
        overrides: [
            {
                test: /\.(js|mjs|ts|tsx)$/,
                include: /[\\/]node_modules[\\/]/,
                plugins: ['babel-plugin-transform-import-meta'],
            },
        ],
    };
};
