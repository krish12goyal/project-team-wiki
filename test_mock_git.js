/**
 * Git Service Mock
 * Identical to gitService.js but with mocked child_process
 */

const util = require('util');
const path = require('path');

// MOCK CONSTANTS
const LOGS = [];
let parallelCount = 0;
let maxParallel = 0;

// Mock exec that takes time
function mockExec(command, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    parallelCount++;
    if (parallelCount > maxParallel) maxParallel = parallelCount;

    // Simulate delay
    setTimeout(() => {
        parallelCount--;
        LOGS.push(`Executed: ${command}`);
        if (callback) callback(null, { stdout: 'mock output', stderr: '' });
    }, 100);
}

const execAsync = util.promisify(mockExec);

// Project root
const PROJECT_ROOT = path.resolve(__dirname, '../../');

// Logic from gitService.js -------------------------------------------

// Simple Mutex for sequential Git operations
class Mutex {
    constructor() {
        this.queue = Promise.resolve();
    }

    lock(callback) {
        const next = this.queue.then(() => callback().catch(err => {
            console.error('Error within Git mutex lock:', err);
            throw err;
        }));
        this.queue = next.catch(() => { }); // Prevent queue blockage on error
        return next;
    }
}

const gitMutex = new Mutex();

async function execGit(command) {
    try {
        const { stdout } = await execAsync(command);
        return stdout.trim();
    } catch (error) {
        throw error;
    }
}

async function gitAdd() {
    return execGit('git add .');
}

async function gitCommit(message) {
    return execGit(`git commit -m "${message}"`);
}

async function gitPush() {
    if (process.env.GIT_AUTO_PUSH === 'true') {
        return execGit('git push');
    } else {
        // Simulate push anyway for test
        return execGit('git push (simulated)');
    }
}

async function autoCommit(message) {
    return gitMutex.lock(async () => {
        console.log(`Starting auto-commit: "${message}"`);
        await gitAdd();
        await gitCommit(message);
        await gitPush();
        console.log('Auto-commit completed successfully.');
    });
}

// -------------------------------------------------------------------

// TEST RUNNER

async function runTest() {
    console.log('Starting Concurrency Test...');

    // Fire 5 autoCommits concurrently
    const promises = [];
    for (let i = 1; i <= 5; i++) {
        promises.push(autoCommit(`Commit ${i}`));
    }

    await Promise.all(promises);

    console.log('\n--- Test Results ---');
    console.log('Max Parallel Executions:', maxParallel); // Should be 1 because Mutex forces serialization of the *blocks*
    // Wait, inside the block (add, commit, push) happens sequentially.
    // The blocks themselves should be sequential.
    // So parallelCount (of exec calls) should never exceed 1 if we only have one git operation at a time.

    console.log('Total Logs:', LOGS.length);
    console.log('Logs Sequence (first 10):');
    LOGS.slice(0, 10).forEach(l => console.log(l));

    // verification
    if (maxParallel > 1) {
        console.error('FAIL: Mutex failed, operations ran in parallel.');
        process.exit(1);
    } else {
        console.log('PASS: Operations were serialized.');
        process.exit(0);
    }
}

runTest();
