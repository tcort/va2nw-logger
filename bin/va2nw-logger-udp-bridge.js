'use strict';

const url = require('url');
const http = require('http');
const https = require('https');
const { ADIF } = require('tcadif');

/* config */

const MCAST_PORT = '2237';
const MCAST_ADDR = '224.0.0.1';
const LOG_DEST = 'http://127.0.0.1/logs';

const ADDITIONS = {
    MY_RIG: 'Yaesu FT-891',
};

// with HTTP BASIC Authorization
// const LOG_DEST = 'https://guest:guest@127.0.0.1/logs';

function upload(json) {
    const dest = new URL(LOG_DEST);
    const data = JSON.stringify(json);

    const httplib = dest.protocol === 'https' ? https : http;

    const options = url.urlToHttpOptions(dest);
    options['Content-Type'] = 'application/json';
    options['Content-Length'] = data.length;

    const req = httplib.request(options, (res) => {
        let data = '';

        console.log('Status Code:', res.statusCode);

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('Body: ', JSON.parse(data));
        });

    }).on("error", (err) => {
        console.log("Error: ", err.message);
    });

    req.write(data);
    req.end();
}

const dgram = require('node:dgram');

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

	console.log(adif.stringify());
        // TODO upload
    } catch (err) {
        console.log('err', err);
    }
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(MCAST_PORT, () => {
    server.setBroadcast(true);
    server.setMulticastTTL(128);
    server.addMembership(MCAST_ADDR);
});
