#!/usr/bin/env node

console.log("NEW CLI VERSION RUNNING");

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const simpleGit = require('simple-git');

const git = simpleGit();

const command = process.argv[2];
const repoUrl = process.argv[3];

const skillIndex = process.argv.indexOf('--skill');
const skillName = process.argv[skillIndex + 1];

console.log("Command:", command);
console.log("Repo URL:", repoUrl);
console.log("Skill Name:", skillName);

async function installSkill() {

    const tempDir = path.join(
        os.tmpdir(),
        'demo-skills-temp'
    );

    if (fs.existsSync(tempDir)) {
        fs.removeSync(tempDir);
    }

    console.log('Cloning repository...');

    await git.clone(repoUrl, tempDir);

    console.log('Repository cloned');

    const source = path.join(
        tempDir,
        '.github',
        'skills',
        skillName
    );

    console.log('Source Path:', source);

    if (!fs.existsSync(source)) {
        console.log('Skill not found');
        return;
    }

    // Create .github/skills folder structure

    const githubFolder = path.join(
        process.cwd(),
        '.github'
    );

    const skillsFolder = path.join(
        githubFolder,
        'skills'
    );

    const destination = path.join(
        skillsFolder,
        skillName
    );

    fs.ensureDirSync(githubFolder);
    fs.ensureDirSync(skillsFolder);

    fs.copySync(source, destination);

    console.log('Skill installed successfully!');
}

installSkill();