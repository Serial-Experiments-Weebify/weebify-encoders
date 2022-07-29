const { spawn } = require("child_process");
const path = require("path");
const {redBright} = require('chalk')

const DETACH_OPTIONS = {
    slient: true,
    detached: true,
    stdio: [null, null, null, "ipc"],
    cwd: process.cwd(),
};

function message(c) {
    return new Promise((resolve) => {
        c.once("message", (msg) => {
            resolve(msg);
        });
    });
}

function eventAsError(c,e) {
    return new Promise((_, reject) => {
        c.once(e, reject);
    });
}

function timeout(t) {
    return new Promise((_, reject) => {
        setTimeout(() => reject("Timed out"), t);
    });
}

async function startUpload(inputFile) {
    const workerFile = path.join(__dirname, "s3-worker.js");

    const fpath = path.resolve(inputFile);
    const fname = path.basename(inputFile);

    let child = spawn("node", [workerFile, fpath, fname], DETACH_OPTIONS);
    try {
        console.log(`S3 Worker running @ ${child.pid}`);

        const msg = await Promise.race([
            message(child),
            eventAsError(child, "error"),
            eventAsError(child, "exit"),
            timeout(5000)
        ]);
        console.log(msg[0])
        child.disconnect
        child.unref(); 
        
    } catch (e) {
        console.error(redBright(e))
        child.kill(); //bratty child, correction needed 💢
    }

}

module.exports = {
    startUpload,
};
