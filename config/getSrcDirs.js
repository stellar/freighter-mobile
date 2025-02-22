/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
const fs = require("fs");
const path = require("path");

/**
 * This function is used to get the source directories for the project.
 * It is used to configure the babel and jest paths so that devs don't
 * need to worry about manually configuring the paths when adding new
 * directories.
 *
 * @param {string} rootDir - The root directory of the project.
 * @param {string} format - The format of the output.
 * @returns {Object} - The source directories.
 */

function getSrcDirs(rootDir, format = "babel") {
  const srcPath = path.resolve(rootDir, "src");
  const directories = fs
    .readdirSync(srcPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (format === "jest") {
    return directories.reduce(
      (acc, dir) => ({
        ...acc,
        [`^${dir}/(.*)$`]: `<rootDir>/src/${dir}/$1`,
      }),
      {},
    );
  }

  return directories.reduce(
    (acc, dir) => ({
      ...acc,
      [dir]: `./src/${dir}`,
    }),
    {},
  );
}

module.exports = getSrcDirs;
