#!/usr/bin/env node

'use strict';

const DB = require('../lib/DB');
const fs = require('fs');

const [ node, prog, filename ] = process.argv;

if (!filename) {
    console.error('wget https://www.skccgroup.com/search/skcclist.txt');
	console.error('%s %s skcclist.txt', node, prog);
	process.exit(1);
}

const db = new DB();

db.open(err => {
	if (err) {
		console.error('DB.open()', err);
		process.exit(1);
	}

	const skcc_roster = fs.readFileSync(filename).toString();
	db.updateSkccRoster(skcc_roster, err => {
		if (err) {
			console.error('DB.updateSkccRoster()', err);
			process.exit(1);
		}

		db.close(err => {
			if (err) {
				console.error('DB.close()', err);
				process.exit(1);
			}

		});
	});
});
