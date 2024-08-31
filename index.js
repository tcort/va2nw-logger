'use strict';

const cors = require('cors');
const express = require('express');
const fs = require('fs');
const hbs = require('hbs');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

/* routing */
app.enable('strict routing');
app.set('case sensitive routing', true);

/* security */
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));

fs
    .readdirSync(path.join(__dirname, 'partials'))
    .forEach(partialFile => {
        const partialName = path.basename(partialFile, path.extname(partialFile));
        const partialText = fs.readFileSync(path.join(__dirname, 'partials', partialFile)).toString();
        hbs.registerPartial(partialName, partialText);
    });

/* rendering */
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
if (process.env.NODE_ENV === 'production') {
    app.enable('view cache');
}
app.set('etag', true);

app.use(require('./lib/routes')());

/* launch the server */
server.listen(3000, 'localhost', function () {
    console.log('service up: http://localhost:3000/');
});
