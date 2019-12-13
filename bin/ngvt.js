#!/usr/bin/env node

// 前提: 需要配置 ./ngvt_config.js:
//     module.exports = {
//         versionFile: './a.js',
//     };
// versionFile中指定的文件中, 加入形如:
//     const VERSION = '1.2.3';
// 的独立代码行.
// 用法: 先用git add添加好需要提交的文件, 然后在当前目录运行: ngvt.js
// 1. 选择版本号(按回车单选). 含义: major: 接口变更; minor: 增加功能; patch: 修改bug.
//      ? Choose version type: (Use arrow keys)
//        major 
//        minor 
//      ❯ patch 
// 2. 确认版本:
//      Old version line of tv_rn: const VERSION = '2.0.2';
//      New version line of tv_rn: const VERSION = '2.0.3';
//      ? Above version info corrent?
// 3. 编辑log, 提交结果.

'use strict'

const inquirer              = require('inquirer');
const fs                    = require('fs');
const os                    = require('os');
const util                  = require('util');
const {loadConfig}          = require('node-autopath-config');
const exec                  = util.promisify(require('child_process').exec);

const lstVersionTypes = ['major', 'minor', 'patch'];
const versionTypeIndexes = {major: 0, minor: 1, patch: 2};
//const versionConfig = {
//    chat_client: {
//        name        : 'chat_client',
//        versionFile : './chat_client/common/Constants.js',
//    },
//}

const myConfig = loadConfig('ngvt_config.js');
console.log('myConfig:', myConfig);

async function getUserOptions() {
    let answers = await inquirer.prompt([
        {
            type   : 'list',
            name   : 'versionType',
            message: 'Choose version type:',
            choices: lstVersionTypes,
            default: 2,
        },
//        {
//            type   : 'checkbox',
//            name   : 'modules',
//            message: 'Select modules to upgrade version number:',
//            choices: Object.keys(versionConfig),
//        },
    ]);

    return answers;
}




async function __main__() {
    let options = await getUserOptions();
    console.log('options:', options);

    let answers;
    do {
        // 检查是否有未缓存的git文件.
        const {stdout, stderr} = await exec('git status -s');
        let unstagedGitChange = false;
        if (stdout) {
            stdout.split(/\r?\n/).forEach((line) => {
                let pos = line.search(/^.M|\?\?|^.D/);
                if (pos >=0) {
                    unstagedGitChange = true;
                }
            });
        }

        if (!unstagedGitChange) {
            break;
        }

        if (unstagedGitChange) {
            answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirmGit',
                    message: 'There are still some unstaged git changes, do you want to commit anyway?',
                    default: false,
                },
            ]);
        }
    } while (!answers.confirmGit);

    // 版本号自增
    let newVersionGitLog = '';
    let changedVersionFiles = [];
    let typeIndex = versionTypeIndexes[options.versionType];
    let versionFilePath = myConfig.versionFile;
    let versionFileText = fs.readFileSync(versionFilePath, 'utf8');
    let lstVersionFileText = versionFileText.split(/\r?\n/);

    lstVersionFileText.forEach((line, ix, arr) => {
        if (line.search(/const VERSION = '\d+\.\d+\.\d+';/) >= 0) {
            console.log(`Old version line: ${line}`);
            let strVersion = line.match(/\d+\.\d+\.\d+/)[0];
            let version = strVersion.split('.');

            version[typeIndex] = parseInt(version[typeIndex]) + 1;
            if (typeIndex <= 1) {
                version[2] = 0; // 提升完高阶版本号后, 将低阶版本号置零.
            }
            if (typeIndex <= 0) {
                version[1] = 0; // 提升完高阶版本号后, 将低阶版本号置零.
            }
            let strNewVersion = version.join('.');
            newVersionGitLog = newVersionGitLog + `New version: ${strNewVersion}\n`;
            let newVersionLine = `const VERSION = '${strNewVersion}';`;
            console.log(`New version line of ${newVersionLine}`);
            arr[ix] = newVersionLine;
        }
    });

    let newVersionFileText = lstVersionFileText.join('\n');
    fs.writeFileSync(versionFilePath, newVersionFileText, 'utf8');

    changedVersionFiles.push(versionFilePath);

    // 版本信息确认
    answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmVersion',
            message: 'Above version info corrent?',
            default: false,
        },
    ]);
    if (!answers.confirmVersion) {
        console.log('Exit');
        return;
    }

    // git提交
    if (typeIndex == 0) {
        newVersionGitLog += `Change API:\n`;
        newVersionGitLog += `Change API:\n`;
    }
    if (typeIndex <= 1) {
        newVersionGitLog += `Function:\n`;
        newVersionGitLog += `Function:\n`;
    }
    if (typeIndex <= 2) {
        newVersionGitLog += `Function:\n`;
        newVersionGitLog += `Fix bug:\n`;
        newVersionGitLog += `Step:\n`;
    }

    console.log('os:', os.platform());
    if (os.platform() == 'win32') {
        console.log('set win32 charReturn');
        newVersionGitLog = newVersionGitLog.replace('\n', '\r\n');
    }

    answers = await inquirer.prompt([
        {
            type: 'editor',
            name: 'gitLogText',
            message: 'Edit git log',
            default: newVersionGitLog,
        },
    ]);
    console.log('### GitLog:', answers);
    //const {stdout, stderr} = await exec(`git commit -m "${newVersionGitLog}"`);

    for (let i = 0; i < changedVersionFiles.length; i++) {
        const {stdout, stderr} = await exec(`git add ${changedVersionFiles[i]}`);
    }
    fs.writeFileSync('./tmp_git_log', answers.gitLogText);
    //const {stdout, stderr} = await exec(`git commit -m "${answers.gitLogText.replace(/\r/g, '')}"`);
    const {stdout, stderr} = await exec(`git commit -F ./tmp_git_log`);
}

if (require.main === module) {
    __main__();
}


// vim:set tw=0:
