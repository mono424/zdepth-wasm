import { execSync, spawnSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

// --- Configuration ---
// Resolve paths relative to the project root (where package.json is)
const PROJECT_ROOT = path.resolve(__dirname, ".."); // 'scripts' folder is inside PROJECT_ROOT

const DIST_DIR = path.join(PROJECT_ROOT, "build");
const WASM_SUBDIR = path.join(DIST_DIR, "wasm_modules");

// Output paths for the WASM glue code and its generated TypeScript definitions
const JS_OUTPUT_WASM = path.join(WASM_SUBDIR, "ZdepthModule.js");
const TSD_OUTPUT_WASM = path.join(WASM_SUBDIR, "ZdepthModule.d.ts"); // .d.ts for the raw WASM module

// Source and output paths for your TypeScript API wrapper
const TS_API_SRC = path.join(PROJECT_ROOT, "src", "zdepthApi.ts");
const TS_API_JS = path.join(DIST_DIR, "zdepthApi.js"); // Compiled JS of your API wrapper
const TS_API_DTS = path.join(DIST_DIR, "zdepthApi.d.ts"); // Generated .d.ts of your API wrapper

// Source files for C++/WASM compilation
// Ensure these paths are correct relative to PROJECT_ROOT
const CXX_SOURCES = [
  path.join(PROJECT_ROOT, "zdepth_wasm", "src", "zdepth_wasm.cpp"), // Assuming zdepth_wasm is a separate folder like zdepth/
  path.join(PROJECT_ROOT, "zdepth", "src", "zdepth.cpp"),
];

// Dynamically find all C source files in zstd/src
const C_SOURCES = fs
  .readdirSync(path.join(PROJECT_ROOT, "zdepth", "zstd", "src"))
  .filter((f) => f.endsWith(".c"))
  .map((f) => path.join(PROJECT_ROOT, "zdepth", "zstd", "src", f));

// Include directories for the C++/WASM compilation
const INCLUDE_DIRS = [
  `-I${path.join(PROJECT_ROOT, "zdepth", "include")}`,
  `-I${path.join(PROJECT_ROOT, "zdepth", "zstd", "include")}`,
  `-I${path.join(PROJECT_ROOT, "zdepth", "zstd", "src")}`, // For headers like bitstream.h
];

// Common Emscripten flags
const EMCC_COMMON_FLAGS = [
  "-s",
  "WASM=1",
  "-s",
  "ALLOW_MEMORY_GROWTH=1",
  "-s",
  "EXPORT_ES6=1",
  "-s",
  "MODULARIZE=1",
  "-s",
  `EXPORT_NAME='ZdepthModule'`,
  "-lembind",
  // Removed '-std=c++11' as it causes issues with C files; emcc defaults are usually fine.
];

// --- Helper Functions ---

/**
 * Runs a shell command and streams its output. Exits process on failure.
 */
function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
) {
  console.log(`\n>>> Executing: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options?.cwd,
    env: options?.env,
  });

  if (result.error) {
    console.error(
      `Command '${command}' failed to start: ${result.error.message}`
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`Command '${command}' exited with status ${result.status}`);
    process.exit(result.status || 1);
  }
  console.log(`<<< Command '${command}' completed successfully.`);
}

/**
 * Ensures a directory exists, creating it recursively if necessary.
 */
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Cleans up build output directories.
 */
function cleanDirs() {
  console.log(`\nCleaning build directories: ${DIST_DIR}`);
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  console.log("Clean complete.");
}

// --- Build Steps ---

/**
 * Builds the WebAssembly module using emcc.
 */
function buildWasm() {
  console.log("\n--- Building WASM Module ---");
  ensureDir(WASM_SUBDIR); // Ensure the output directory for WASM exists

  const emccArgs = [
    ...CXX_SOURCES, // Your C++ source files
    ...C_SOURCES, // Zstd C source files
    ...INCLUDE_DIRS, // Include paths
    ...EMCC_COMMON_FLAGS, // Common Emscripten flags
    "--emit-tsd",
    TSD_OUTPUT_WASM, // Generate WASM's .d.ts
    "-o",
    JS_OUTPUT_WASM, // Main output: JS glue code (WASM binary is generated alongside)
  ];

  runCommand("emcc", emccArgs, { cwd: PROJECT_ROOT });
  console.log("WASM module build complete.");
}

/**
 * Compiles the TypeScript API wrapper using tsc.
 */
function buildTsApi() {
  console.log("\n--- Building TypeScript API Wrapper ---");
  ensureDir(DIST_DIR); // Ensure dist dir exists for tsc output

  // `tsc` reads tsconfig.json from the current working directory
  // We pass PROJECT_ROOT as cwd to ensure it finds the correct tsconfig.json
  runCommand("npx", ["tsc"], { cwd: PROJECT_ROOT });
  console.log("TypeScript API wrapper build complete.");
}

// --- Main Script Execution Logic ---

const args = process.argv.slice(2); // Get command-line arguments after 'tsx scripts/build.ts'

if (args.includes("--clean")) {
  cleanDirs();
} else if (args.includes("--wasm")) {
  // Only build WASM part
  buildWasm();
} else if (args.includes("--ts-api")) {
  // Only build TypeScript API part
  buildTsApi();
} else {
  // Default: full package build
  console.log("\n--- Starting Full Package Build ---");
  cleanDirs(); // Always clean before a full build
  buildWasm(); // Build the WASM module and its types
  buildTsApi(); // Compile the TypeScript API wrapper and its types
  console.log("\n--- Full Package Build Complete ---");
  console.log(
    `Package is ready in the "${DIST_DIR}" directory for npm publish or local linking.`
  );
}
