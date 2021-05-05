#! /usr/bin/env node

const fs = require("fs");
const {execSync, exec} = require('child_process');
const path = require("path");
const chalk = require("chalk");
const got = require("got");
const unzipper = require("unzipper");

const cwd = process.cwd();
const args = process.argv;

const INSTALL = args.indexOf('--no-install') === -1;

const PATHS = {
    theme: path.resolve(cwd, 'theme'),
    themeV8: path.resolve(cwd, 'theme/styles/web'),
    package: path.resolve(cwd, 'package.json'),
    packageLock: path.resolve(cwd, 'package-lock.json'),
    gulpfile: path.resolve(cwd, 'Gulpfile.js'),
    node_modules: path.resolve(cwd, 'node_modules'),
    svnFolder: path.resolve(cwd, '.svn')
}

const REPO = "https://api.github.com/repos/mendixlabs/ux-theming/releases";
const BASIC_OPTIONS = {
    headers: { 'User-Agent': 'MendixLabs-InstallUX-Theming/1.0' },
}

const BANNER = [
    '',
    ` ==== INSTALL UX THEMING FOR MENDIX ====`,
    ``
].join('\n');
const ID = chalk.green('[INSTALL-UX-THEMING]');

const getLatestRepo = async () => {
    try {
        const json = await got(REPO, {
            ...BASIC_OPTIONS,
            responseType: 'json', resolveBodyOnly: true
        })
        const release = json[0];
        const gulpAsset = release.assets.find(a => a.name === 'Gulp.zip');

        if (gulpAsset) {
            return gulpAsset.browser_download_url;
        } else {
            return null;
        }
    } catch (error) {
        throw(error);
    }
};

const getZip = async (url) => {
    try {
        const zip = await got(url, {
            ...BASIC_OPTIONS,
            responseType: 'buffer', resolveBodyOnly: true
        });

        await unzipper.Open.buffer(zip).then(d => d.extract({ path: cwd, concurrency: 2 }));
    } catch (error) {
        throw(error);
    }
};

const checkTheme = () => new Promise((resolve, reject) => {
    const themeV8 = fs.existsSync(PATHS.themeV8);

    if (themeV8) {
        console.log(ID, `Applying MX8+ fix to Gulpfile (sourceStyleFolder, deploymentStyleFolder)`);

        fs.readFile(PATHS.gulpfile, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }

            const res = data
                .replace(`'theme/styles'`, `'theme/styles/web'`)
                .replace(`'styles'`, `'styles/web'`);

            fs.writeFile(PATHS.gulpfile, res, 'utf8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        })
    } else {
        resolve();
    }

});

const checkExisting = async () => {
    const packageExist = fs.existsSync(PATHS.package);
    const gulpExist = fs.existsSync(PATHS.gulpfile);

    if (packageExist && gulpExist) {
        console.log(ID, `Package and Gulpfile exists`);
        return true;
    }
    return false;
};

const checkSVN = async () => {
    const svn = fs.existsSync(PATHS.svnFolder);

    if (svn) {
        const msg = [
            chalk.yellow.underline("This is a SVN project. Please add "),
            chalk.green.bold.underline("node_modules"),
            chalk.yellow.underline(" folder to your SVN ignore (after install is complete) before committing!")
        ].join('')
        console.log(ID, msg);
    }
}

const clearFolder = async () => {
    if (fs.existsSync(PATHS.package)) {
        fs.unlinkSync(PATHS.package);
    }
    if (fs.existsSync(PATHS.packageLock)) {
        fs.unlinkSync(PATHS.packageLock);
    }
    if (fs.existsSync(PATHS.gulpfile)) {
        fs.unlinkSync(PATHS.gulpfile);
    }
}

const clearNodeModules = () => new Promise((resolve, reject) => {
    if (fs.existsSync(PATHS.node_modules) && INSTALL) {
        try {
            fs.rm(PATHS.node_modules, { force: true, recursive: true }, () => {
                resolve();
            });
        } catch (error) {
            console.error(error);
            throw(error);
        }
    } else {
        resolve();
    }
})

const installPackages = async () => {
    return execSync(`npm install`, { stdio: "inherit", cwd })
}

const main = async () => {
    console.log(BANNER);
    if (!fs.existsSync(PATHS.theme)) {
        console.log(ID, `I cannot find a ${chalk.green('theme')} folder, exiting. It should be installed in the root of your Mendix project`);
        process.exit(0);
    }
    console.log(ID, `Clear folder`)
    await clearFolder();
    await clearNodeModules();
    console.log(ID, `Getting latest release from Github ${chalk.green('(mendixlabs/ux-theming)')}`)
    const latest = await getLatestRepo();
    if (latest) {
        console.log(ID, `Downloading: ${chalk.green(latest)}`);
        await getZip(latest);
        console.log(ID, `Extracted files, checking`);
        const existing = await checkExisting();
        if (existing && INSTALL) {
            console.log(ID, `Install packages`);
            await installPackages();
            await checkSVN();
        }

        await checkTheme();
        console.log(ID, 'DONE')
    } else {
        console.error(ID, chalk.red(`Latest release not found`));
    }
    console.log('\n');
}

main();
