const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    "buffer": require.resolve("buffer/"),
    "stream": require.resolve("stream-browserify"),
    "process": require.resolve("process/browser"),
  });
  config.resolve.fallback = fallback;

  // Fixes 'Filter', 'Player', etc. not found in 'tone' by aliasing to the UMD build
  config.resolve.alias = {
    ...config.resolve.alias,
    'tone': 'tone/build/Tone.js'
  };

  // 3. Locate the 'oneOf' rule where CRA keeps its loaders
  const oneOfRule = config.module.rules.find(rule => rule.oneOf);
  if (oneOfRule) {
    // Add support for .mjs files and allow non-fully specified imports
    oneOfRule.oneOf.unshift({
      test: /\.m?js$/, // This rule should apply to JS files
      exclude: [/src/, /\.json$/], // Exclude src folder and any .json files
      type: 'javascript/auto',
      resolve: { fullySpecified: false }
    });

    // Fix the JSON parsing error for tonal-dictionary and other data-heavy libraries
    oneOfRule.oneOf.unshift({
      test: /\.json$/,
      type: 'json'
    });
  }

  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ]);

  // Suppress Magenta source-map warnings (Magenta references .ts files that aren't in the npm package)
  config.ignoreWarnings = [
    { module: /node_modules\/@magenta\/music/ },
    { module: /node_modules\/source-map-loader/ },
    /Failed to parse source map/
  ];

  return config;
};