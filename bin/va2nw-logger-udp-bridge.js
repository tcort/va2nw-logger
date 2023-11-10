'use strict';

const { ADIF, QSO } = require('tcadif');
const dgram = require('dgram');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const url = require('url');

/* config */

let userConfig = {};
try {
    userConfig = JSON.parse(fs.readFileSync('./va2nw-logger-udp-bridge.conf').toString());
} catch (e) {
    console.error('Trouble loading user config', e);
}

let defaultConfig = {};
try {
    defaultConfig = JSON.parse(fs.readFileSync('./va2nw-logger-udp-bridge.conf.defaults').toString());
} catch (e) {
    console.error('Trouble loading default config', e);
}

const config = Object.assign({}, defaultConfig, userConfig);

/* uploader */

function upload(qso) {
    const dest = new URL(config.output.LOG_DEST);
    const json = qso.toObject();
    const body = JSON.stringify(Object.assign({}, config.output.ADDITIONS, json));

    const httplib = dest.protocol === 'https:' ? https : http;

    const options = url.urlToHttpOptions(dest);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
    };

    const req = httplib.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            const json = JSON.parse(data);
            const qso = new QSO(json);
            console.log(`${res.statusCode}:`, qso.stringify({ fieldDelim: ' '}));
        });

    }).on("error", (err) => {
        console.log("Error: ", err.message);
    });

    req.write(body);
    req.end();
}

/* receiver */

const server = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
});

server.on('error', (err) => {
    console.error(`server error:\n${err.stack}`);
    server.close();
});

server.on('message', (input, rinfo) => {
    try {
        const adif = ADIF.parse(input.toString());
        if (adif.qsos.length === 0) {
            return; // no qsos found in message, nothing to do.
        }

        adif.qsos.forEach(qso => upload(qso));
    } catch (err) {
        console.log('err', err);
    }
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(config.input.MCAST_PORT, () => {
    server.setBroadcast(true);
    server.setMulticastTTL(128);
    server.addMembership(config.input.MCAST_ADDR);
});
