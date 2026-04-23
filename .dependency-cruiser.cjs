const fs = require("node:fs");
const path = require("node:path");

const featuresDir = path.join(__dirname, "src", "features");
const featureNames = fs
  .readdirSync(featuresDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: featureNames.map((featureName) => ({
    name: `no-cross-feature-imports-${featureName}`,
    comment: `Feature ${featureName} should not import from other features directly.`,
    severity: "error",
    from: {
      path: `^src/features/${featureName}/`,
    },
    to: {
      path: `^src/features/(?!${featureName}/)`,
    },
  })),
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
    },
  },
};
