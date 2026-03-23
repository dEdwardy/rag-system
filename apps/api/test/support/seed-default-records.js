const { execFileSync } = require("node:child_process");

function seedDefaultRecords(apiRoot) {
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });
}

module.exports = {
  seedDefaultRecords
};
