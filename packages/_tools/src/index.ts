#!/usr/bin/env bun

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from './build.js';


const args = process.argv.slice(2);

const packageName = args[0];
if (!packageName)
	throw new Error('Package name as first argument is required');

const workspaceRoot = join(__dirname, '..', '..', '..');
const packagesPath = join(workspaceRoot, 'packages');
const availablePackages = readdirSync(packagesPath);

const pkgDirname = availablePackages.find(pkg => {
	const pkgJsonPath = join(packagesPath, pkg, 'package.json');

	try {
		const pkgJson = readFileSync(pkgJsonPath, 'utf8');
		const { name } = JSON.parse(pkgJson);

		return name === packageName;
	}
	catch {
		return false;
	}
});

if (!pkgDirname)
	throw new Error(`Package "${ packageName }" not found`);


const pkgDir = join(packagesPath, pkgDirname);
build(pkgDir);
