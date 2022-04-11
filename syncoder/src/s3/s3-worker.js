const AWS = require("aws-sdk");
const { stat, readFile } = require("fs/promises");
const path = require("path");
const os = require("os");
const fs = require("fs");

async function getConfig() {
    try {
        const contents = await readFile(path.join(os.homedir(), ".uploadedrc"));
        const cfg = JSON.parse(contents);
        return cfg;
    } catch (e) {
        throw "Could not read config. ( ~/.uploadedrc )";
    }
}

async function exists(file) {
    try {
        await stat(file);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const config = await getConfig();

    const f = path.resolve(process.argv[2]),
        fn = process.argv[3];

    if (!(await exists(f))) {
        throw "File doesn't exist";
    }

    AWS.config.update({
        credentials: {
            accessKeyId: config.user.accessKey,
            secretAccessKey: config.user.secret,
        },
    });

    const S3 = new AWS.S3({
        endpoint: config.provider.endpoint,
        region: config.provider.region,
        accessKeyId: config.user.accessKey,
        secretAccessKey: config.user.secret,
    });

    const u = S3.putObject({
        Bucket: config.destination.bucket,
        Key: `${config.destination.prefix}${fn}`,
        Body: fs.createReadStream(f),
    });

    u.on("httpUploadProgress", (x) => {
        try {
            process.send(["sucess", x]);
        } catch {
        }
    });

    u.on("error", (x) => {
        try {
           process.send(["error", x]);
        } catch {
            proces.exit(69)
        }
    });

    u.on("complete", (x) => {
        try {
            process.send(["sucess", x]);
        } catch {}
        process.exit(0);
    });

    u.send();
}

setTimeout(() => {
    main().catch((x) => {
        fs.writeFileSync("err",x);
        process.send(["error", x]);
    });
}, 10);  //this is a horrible hack...
