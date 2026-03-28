module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ['babel-preset-expo', {
                jsxRuntime: 'automatic',
                unstable_transformProfile: 'hermes-stable',
            }]
        ],
        plugins: [
            // Must come BEFORE reanimated
            ['babel-plugin-transform-import-meta', {
                module: 'ES6',
            }],
            'react-native-reanimated/plugin',
        ],
        // Apply to ALL files, including node_modules
        overrides: [
            {
                test: /\.(js|jsx|ts|tsx|mjs)$/,
                plugins: ['babel-plugin-transform-import-meta'],
            },
            {
                test: /node_modules[\\/](pusher-js|@pusher|react-native-webrtc|framer-motion)/,
                plugins: ['babel-plugin-transform-import-meta'],
                sourceType: 'unambiguous',
            },
        ],
        sourceType: 'unambiguous',
    };
};