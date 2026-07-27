import packageJson from "@playwright/test/package.json";

const image = `mcr.microsoft.com/playwright:v${packageJson.version}-noble`;
const command = [
  "docker",
  "run",
  "--rm",
  "-v",
  `${process.cwd()}:/work`,
  "-w",
  "/work",
  "-e",
  "VISUAL=1",
  image,
  "npx",
  "playwright",
  "test",
  "--project=visual",
  "--update-snapshots",
];
const processHandle = Bun.spawn(command, {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await processHandle.exited);
