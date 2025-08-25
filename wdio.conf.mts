import * as path from "path"
import { obsidianBetaAvailable } from "wdio-obsidian-service";

const cacheDir = path.resolve(".obsidian-cache");

// Test with Obsidian 1.3.7 specifically
const versions: [string, string][] = [
    ["1.3.7", "1.3.7"],  // It can only work with 1.3.7
];

// Optionally, you can also test against latest to ensure forward compatibility
// Uncomment the following lines if you want to test multiple versions:
// versions.push(["latest", "latest"]);
// if (await obsidianBetaAvailable(cacheDir)) {
//     versions.push(["latest-beta", "latest"]);
// }

export const config: WebdriverIO.Config = {
    runner: 'local',
    framework: 'mocha',
    
    // Test specs location
    specs: [
        './tests/e2e/specs/**/*.e2e.ts'
    ],
    
    // How many instances of Obsidian should be launched in parallel
    maxInstances: 4,
    
    // Configure Obsidian capabilities for each version
    capabilities: versions.map(([appVersion, installerVersion]) => ({
        browserName: 'obsidian',
        browserVersion: appVersion,
        'wdio:obsidianOptions': {
            installerVersion: installerVersion,
            plugins: ["."], // Load the current plugin
            vault: "tests/e2e/vaults/test-vault", // Default test vault
        },
    })),
    
    // Services
    services: ["obsidian"],
    
    // Use the obsidian reporter to show Obsidian version instead of Chromium
    reporters: ['obsidian'],
    
    // Cache directory for downloaded Obsidian versions
    cacheDir: cacheDir,
    
    // Mocha options
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000, // 60 seconds timeout for tests
        retry: 0, // Don't retry failed tests by default
    },
    
    // Logging level
    logLevel: "warn",
    
    // Base URL (not used for Obsidian testing)
    baseUrl: '',
    
    // Default timeout for all waitFor* commands
    waitforTimeout: 10000,
    
    // Connection retry options
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    // Hooks for test lifecycle
    before: async function (capabilities, specs) {
        // Global setup before all tests
        console.log(`Testing pandoc-lists-plugin with Obsidian ${capabilities.browserVersion}`);
    },
    
    beforeSuite: async function (suite) {
        // Setup before each test suite
        console.log(`Starting suite: ${suite.title}`);
    },
    
    afterSuite: async function (suite) {
        // Cleanup after each test suite
        console.log(`Finished suite: ${suite.title}`);
    },
    
    after: async function (result, capabilities, specs) {
        // Global cleanup after all tests
        console.log(`Tests completed with ${result === 0 ? 'success' : 'failures'}`);
    }
}
