/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
