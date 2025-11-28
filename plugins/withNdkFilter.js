const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin to exclude 32-bit ARM architectures
 * Cactus SDK only supports arm64-v8a and x86_64
 */
module.exports = function withNdkFilter(config) {
  return withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    
    // Check if ndk filter already exists
    if (buildGradle.includes('abiFilters')) {
      return config;
    }
    
    // Add ndk filter inside defaultConfig
    const modifiedBuildGradle = buildGradle.replace(
      /defaultConfig\s*\{([^}]*versionName[^}]*)\}/,
      `defaultConfig {$1
        // Exclude 32-bit ARM - Cactus SDK only supports 64-bit
        ndk {
            abiFilters "arm64-v8a", "x86_64"
        }
    }`
    );
    
    config.modResults.contents = modifiedBuildGradle;
    return config;
  });
};

