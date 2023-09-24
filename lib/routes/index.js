'use strict';

const { AdifReader, AdifWriter, enums } = require('tcadif');
const Cabrillo = require('../Cabrillo');
const CombUUID = require('comb-uuid');
const { Readable } = require('stream');
const csv = require('csv-stringify');
const DB = require('../DB');
const bytes = require('bytes');
const express = require('express');
const fileUpload = require('express-fileupload');
const methodOverride = require('method-override');
const moment = require('moment');
const path = require('path');

const router = express.Router({
    strict: true,
    caseSensitive: true,
    mergeParams: true,
});

router.get('/', (req, res, next) => {
    res.redirect('/logs');
});

router.use(express.static(path.join(__dirname, '..', '..', 'public')));

router.use(fileUpload({
    safeFileNames: true,
    preserveExtension: true,
    limits: {
        files: 1,
        fileSize: bytes('1MB'),
    }
}));
router.use(express.json());
router.use(express.urlencoded({ extended: false }));
router.use(methodOverride('_method'));

router.use(function (req, res, next) {

    res.locals.ts = Date.now();

    req.db = new DB();

    req.db.open(err => {
        if (err) {
            return next(err);
        }
        next();
    });
});

router.get('/skcc/:CALL', function (req, res, next) {
    req.db.getSkccRosterMember(`${req.params.CALL}`.toUpperCase().trim(), (err, member) => {
        if (err) {
            return next(member);
        }
        res.json(member);
        req.db.close();
    });
});

router.post('/logs', function (req, res, next) {

    if (req.is('multipart/form-data')) {
        if (!req.files || !req.files.adif_file) {
            const err = new Error('file not found');
            return next(err);
        }

        let in_flight = 0;
        let fail = false;

        const adif = req.files.adif_file.data.toString();
        const reader = new AdifReader();

        reader.on('data', qso => {
            in_flight++;
            req.db.upsert(qso, (err) => {
                if (err) {
                    console.log(err);
                }
                in_flight--;
            });
        });
        reader.on('error', err => next(err));
        reader.on('finish', () => {
            (function checkComplete() {
                if (in_flight === 0) {
                    res.redirect('/logs');
                    req.db.close();
                } else {
                    setTimeout(() => checkComplete(), 100);
                }
            })();
        });

        reader.write(adif);
        reader.end();
        return;
    }

    req.body.QSO_DATE = `${req.body.YEAR}${req.body.MONTH}${req.body.DAY}`;
    req.body.TIME_ON = `${req.body.HOUR}${req.body.MINUTE}${req.body.SECOND}`;

    req.body.QSO_DATE_OFF = `${req.body.YEAR_OFF}${req.body.MONTH_OFF}${req.body.DAY_OFF}`;
    req.body.TIME_OFF = `${req.body.HOUR_OFF}${req.body.MINUTE_OFF}${req.body.SECOND_OFF}`;

    const qso = Object.fromEntries(Object.entries(req.body).filter(([ key, value ]) => value !== ''));

    req.db.insert(qso, err => {
        if (err) {
            return next(err);
        }
        res.redirect('/logs');
        req.db.close();
    });

});

router.get('/logs/:APP_TCADIF_QSO_ID', function (req, res, next) {
    req.db.selectOne(req.params.APP_TCADIF_QSO_ID, (err, log) => {
        if (err) {
            return next(err);
        }

        const filename = `log-${log.APP_TCADIF_QSO_ID}-${moment.utc().format('YYYYMMDDHHmmss')}.${req.query.fmt}`;
        if (req.query.dl === '1') {
            res.set('Content-Disposition', `attachment; filename="${filename}"`);
        }

        switch (req.query.fmt) {

            case 'adi':
                const writer = new AdifWriter();
                writer.pipe(res);
                writer.write(log);
                writer.end();
                req.db.close();
                break;
            case 'cab':
                res.set('Content-Type', 'text/plain');
                res.send(Cabrillo.toQSO(log));
                req.db.close();
                break;
            case 'csv':
                res.set('Content-Type', 'text/csv');
                Readable.from([log])
                    .pipe(csv.stringify({ header: true, quoted: true }))
                    .pipe(res);
                req.db.close();
                break;
            case 'json':
                res.json(log);
                req.db.close();
                break;
            default:
                res.render('log', { log }, function (err, html) {
                    if (err) {
                        return next(err);
                    }
                    res.send(html);
                    req.db.close();
                });
                return;
        }
    });
});

router.delete('/logs/:APP_TCADIF_QSO_ID', function (req, res, next) {
    req.db.remove(req.params.APP_TCADIF_QSO_ID, err => {
        if (err) {
            return next(err);
        }
        res.redirect('/logs');
        req.db.close();
    });
});

router.get('/logs', function (req, res, next) {

    req.db.select(req.query, (err, logs) => {
        if (err) {
            return next(err);
        }

        const filename = `logs-${moment.utc().format('YYYYMMDDHHmmss')}.${req.query.fmt}`;
        if (req.query.dl === '1') {
            res.set('Content-Disposition', `attachment; filename="${filename}"`);
        }

        switch (req.query.fmt) {

            case 'adi':
                const writer = new AdifWriter();
                writer.pipe(res);
                logs.forEach(log => writer.write(log));
                writer.end();
                req.db.close();
                break;
            case 'cab':
                res.set('Content-Type', 'text/plain');
                const lines = logs.map(log => Cabrillo.toQSO(log)).join('\n');
                res.send(lines);
                req.db.close();
                break;
            case 'csv':
                res.set('Content-Type', 'text/csv');
                Readable.from(logs)
                    .pipe(csv.stringify({ header: true, quoted: true }))
                    .pipe(res);
                req.db.close();
                break;
            case 'json':
                res.json(logs);
                req.db.close();
                break;
            default:
                res.render('logs', { logs, enums }, function (err, html) {
                    if (err) {
                        return next(err);
                    }
                    res.send(html);
                    req.db.close();
                });
                return;
        }

    });
});

router.get('/callsigns', function (req, res, next) {
    req.db.callsignStartsWith(req.query.startsWith ?? '', function (err, completions) {
        if (err) {
            return next(err);
        }
        res.json(completions);
        req.db.close();
    });
});

router.get('/my-rigs', function (req, res, next) {
    req.db.myRigStartsWith(req.query.startsWith ?? '', function (err, completions) {
        if (err) {
            return next(err);
        }
        res.json(completions);
        req.db.close();
    });
});

router.get('/my-antennas', function (req, res, next) {
    req.db.myAntennaStartsWith(req.query.startsWith ?? '', function (err, completions) {
        if (err) {
            return next(err);
        }
        res.json(completions);
        req.db.close();
    });
});

router.get('/app-tcadif-my-key-info', function (req, res, next) {
    req.db.appTcadifMyKeyInfoStartsWith(req.query.startsWith ?? '', function (err, completions) {
        if (err) {
            return next(err);
        }
        res.json(completions);
        req.db.close();
    });
});

router.use(function (req, res, next) {
    req.db.close(err => {
        req.db = null;
        if (err) {
            return next(err);
        }

        if (!res.headersSent) {
            err = new Error('Not Found');
            err.status = 404;
            err.url = req.url;
            return next(err);
        }

        // done :)
    });
});

router.use(function (err, req, res, next) {
    console.log(err);
    if (req.db) {
        req.db.close(innerErr => {
            req.db = null;
            if (innerErr) {
                console.log(innerErr);
            }
            res.json(err);
        });
        return;
    }

    res.json(err);
});

module.exports = router;
