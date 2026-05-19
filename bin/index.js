#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const command = process.argv[2];
const skillName = process.argv[3];

if (command === 'add') {

    console.log(`Installing skill: ${skillName}`);

    const source = path.join(
        __dirname,
        '../skills',
        skillName
    );

    const destination = path.join(
        process.cwd(),
        '.skills',
        skillName
    );

    if (!fs.existsSync(source)) {
        console.log('Skill not found');
        process.exit(1);
    }

    fs.copySync(source, destination);

    console.log('Skill installed successfully!');
}