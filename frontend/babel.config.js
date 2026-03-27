module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ['babel-preset-expo', {
                jsxRuntime: 'automatic',
            }]
        ],
        plugins: [
            // Transform import.meta with proper configuration
            ['babel-plugin-transform-import-meta', {
                module: 'ES6',
            }],
            // Reanimated plugin must be last
            'react-native-reanimated/plugin',
        ],
        // Add this to handle import.meta in node_modules
        overrides: [
            {
                test: /node_modules[\\/]pusher-js/,
                plugins: ['babel-plugin-transform-import-meta'],
            },
            {
                test: /node_modules[\\/]@pusher/,
                plugins: ['babel-plugin-transform-import-meta'],
            },
        ],
    };
};