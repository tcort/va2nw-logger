'use strict';

const _ = require('lodash');
const { AdifReader, AdifWriter } = require('tcadif');
const DB = require('./DB');
const QSO = require('./QSO');
const bytes = require('bytes');
const tcadif = require('tcadif');
const express = require('express');
const fileUpload = require('express-fileupload');
const methodOverride = require('method-override');
const moment = require('moment');
const path = require('path');

function routerFactory(options = {}) {

    const router = express.Router({
        strict: true,
        caseSensitive: true,
        mergeParams: true,
    });

    router.use(express.static(path.join(__dirname, '..', 'public')));
    router.use(fileUpload({
        safeFileNames: true,
        preserveExtension: true,
        limits: {
            files: 1,
            fileSize: bytes('10MB'),
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

    router.get('/', (req, res, next) => {
        res.render('index', { enums: tcadif.enums }, function (err, html) {
            if (err) {
                return next(err);
            }
            res.send(html);
            next();
        });
    });

    router.post('/qsos', (req, res, next) => {

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

                req.db.upsert(QSO.fromAO(qso).toDBO(), (err) => {
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
                        res.redirect('/');
                        next();
                    } else {
                        setTimeout(() => checkComplete(), 100);
                    }
                })();
            });

            reader.write(adif);
            reader.end();
            return;
        }

        const qso = new QSO({
            timeon: `${req.body.year_on}-${req.body.month_on.padStart(2, '0')}-${req.body.day_on.padStart(2, '0')}T${req.body.hour_on.padStart(2, '0')}:${req.body.minute_on.padStart(2, '0')}:${req.body.second_on.padStart(2, '0')}.000Z`,
            timeoff: `${req.body.year_off}-${req.body.month_off.padStart(2, '0')}-${req.body.day_off.padStart(2, '0')}T${req.body.hour_off.padStart(2, '0')}:${req.body.minute_off.padStart(2, '0')}:${req.body.second_off.padStart(2, '0')}.000Z`,
            frequency: req.body.frequency,
            mode: req.body.mode,
            power: req.body.power,
            callsign: req.body.callsign,
            rst_sent: req.body.rst_sent,
            rst_rcvd: req.body.rst_rcvd,
            qsl_sent: false,
            qsl_rcvd: false,
            remarks: req.body.remarks,
        });

        req.db.insert(qso.toDBO(), err => {
            if (err) {
                return next(err);
            }

            res.redirect('/');
            next();
        });
    });

    router.get('/qsos', function (req, res, next) {
        req.db.countQsos(req.query, (err, count) => {
            if (err) {
                return next(err);
            }

            const pageSize = Math.abs(isNaN(parseInt(req.query.pageSize)) ? 25 : parseInt(req.query.pageSize));
            const pages = Math.floor(count / pageSize);
            let page = pages;

            const requestedPage = parseInt(req.query.page);
            if (!isNaN(requestedPage) && 0 <= requestedPage && requestedPage <= pages) {
                page = requestedPage;
            }

            req.db.select(Object.assign({ order: 'asc', page, pageSize }, req.query), (err, qsos) => {
                if (err) {
                    return next(err);
                }

                const filename = `va2nw-logger-qsos-${moment.utc().format('YYYYMMDDHHmmss')}.${req.query.fmt}`;
                if (req.query.dl === '1') {
                    res.set('Content-Disposition', `attachment; filename="${filename}"`);
                }

                switch (req.query.fmt) {

                    case 'adi':
                        const writer = new AdifWriter();
                        writer.pipe(res);
                        qsos.forEach(qso => writer.write(qso.toAO()));
                        writer.end();
                        next();
                        break;

                    case 'json':
                        res.json(qsos.map(qso => qso.toJSON()));
                        next();
                        break;

                    default:

                        qsos = qsos.map(qso => qso.toRender());

                        const pageNav = [];

                        if (page !== 0) {
                            pageNav.push({ label: 'First', page: 0 });
                        }
                        if (page - 1 >= 0) {
                            pageNav.push({ label: 'Prev', page: page - 1 });
                        }
                        if (page + 1 <= pages) {
                            pageNav.push({ label: 'Next', page: page + 1 });
                        }
                        if (page !== pages) {
                            pageNav.push({ label: 'Last', page: pages });
                        }

                        res.render('qsos', { qsos, pageNav }, function (err, html) {
                            if (err) {
                                return next(err);
                            }
                            res.send(html);
                            next();
                        });
                        break;
                }
            });
        });
    });

    router.get('/qsos/:qso_id', function (req, res, next) {
        req.db.selectOne(req.params.qso_id, (err, qso) => {
            if (err) {
                return next(err);
            }

            if (req.query.form === 'edit') {
                qso = qso.toEdit();
            } else {
                qso = qso.toRender();
            }

            res.render(req.query.form === 'edit' ? 'qso-editor' : 'qso', { qso }, function (err, html) {
                if (err) {
                    return next(err);
                }
                res.send(html);
                next();
            });

        });
    });

    router.put('/qsos/:qso_id', function (req, res, next) {

        req.db.selectOne(req.params.qso_id, (err, originalQso) => {
            if (err) {
                return next(err);
            }

            const inputQso = new QSO({
                timeon: `${req.body.year_on}-${req.body.month_on.padStart(2, '0')}-${req.body.day_on.padStart(2, '0')}T${req.body.hour_on.padStart(2, '0')}:${req.body.minute_on.padStart(2, '0')}:${req.body.second_on.padStart(2, '0')}.000Z`,
                timeoff: `${req.body.year_off}-${req.body.month_off.padStart(2, '0')}-${req.body.day_off.padStart(2, '0')}T${req.body.hour_off.padStart(2, '0')}:${req.body.minute_off.padStart(2, '0')}:${req.body.second_off.padStart(2, '0')}.000Z`,
                frequency: req.body.frequency,
                mode: req.body.mode,
                power: req.body.power,
                callsign: req.body.callsign,
                rst_sent: req.body.rst_sent,
                rst_rcvd: req.body.rst_rcvd,
                qsl_sent: typeof req.body.qsl_sent === 'undefined' ? undefined : req.body.qsl_sent === 'Y',
                qsl_rcvd: typeof req.body.qsl_rcvd === 'undefined' ? undefined : req.body.qsl_rcvd === 'Y',
                remarks: req.body.remarks,
            });

            // default values from existing qso
            const qso = _.defaultsDeep(inputQso.toDBO(), originalQso.toDBO());

            // update db record
            req.db.update(req.params.qso_id, qso, (err) => {
                if (err) {
                    return next(err);
                }
                res.redirect('/qsos');
                next();
            });
        });
    });

    router.delete('/qsos/:qso_id', function (req, res, next) {
        req.db.delete(req.params.qso_id, (err) => {
            if (err) {
                return next(err);
            }
            res.redirect('/qsos');
            next();
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

    return router;
}

module.exports = routerFactory;