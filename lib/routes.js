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
        res.locals.enums = tcadif.enums;

        req.db = new DB();

        req.db.open(err => {
            if (err) {
                return next(err);
            }
            next();
        });
    });

    router.get('/',  (req, res, next) => {
        res.redirect('/qsos/new');
        req.db.close();
    });


    router.get('/qsos/new', (req, res, next) => {
        res.render('qso-create', { }, function (err, html) {
            if (err) {
                return next(err);
            }
            res.send(html);
            req.db.close();
        });
    });

    router.get('/qsos/import', (req, res, next) => {
        res.render('qso-import', { }, function (err, html) {
            if (err) {
                return next(err);
            }
            res.send(html);
            req.db.close();
        });
    });

    router.get('/qsos/export', (req, res, next) => {
        res.render('qso-export', { }, function (err, html) {
            if (err) {
                return next(err);
            }
            res.send(html);
            req.db.close();
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

                const additionalRemarks = [];

                if (qso.CONTEST_ID) { additionalRemarks.push(qso.CONTEST_ID.replace(/^K1USN-/, '')); }
                if (qso.SIG && qso.SIG_INFO) { additionalRemarks.push(`${qso.SIG} ${qso.SIG_INFO}`); }
                if (qso.APP_TCADIF_LICW) { additionalRemarks.push(`LICW ${qso.APP_TCADIF_LICW}`); }
                if (qso.SKCC) { additionalRemarks.push(`SKCC ${qso.SKCC}`); }
                if (qso.NAME) { additionalRemarks.push(qso.NAME); }
                if (qso.STATE) { additionalRemarks.push(qso.STATE); }
                if (qso.STX) { additionalRemarks.push(qso.STX); }
                if (qso.STX_STRING) { additionalRemarks.push(qso.STX_STRING); }
                if (qso.SRX) { additionalRemarks.push(qso.SRX); }
                if (qso.SRX_STRING) { additionalRemarks.push(qso.SRX_STRING); }
                if (qso.MY_SIG && qso.MY_SIG_INFO) { additionalRemarks.push(`@ ${qso.MY_SIG} ${qso.MY_SIG_INFO}`); }
                if (qso.OPERATOR && qso.STATION_CALLSIGN && qso.OPERATOR !== qso.STATION_CALLSIGN) { additionalRemarks.push(`operating as ${qso.STATION_CALLSIGN}`); }

                qso.NOTES = qso.NOTES ?? '';
                qso.NOTES = qso.NOTES + ' ' +  additionalRemarks.join(' ');
                qso.NOTES = qso.NOTES.trim().replace(/\s+/g, ' ');

                req.db.qsoUpsert(QSO.fromAO(qso).toDBO(), (err) => {
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
                        res.redirect('/qsos/new');
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

        const qso = new QSO({
            timeon: `${req.body.date_on} ${req.body.time_on}.000Z`,
            timeoff: `${req.body.date_off} ${req.body.time_off}.000Z`,
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

        req.db.qsoInsert(qso.toDBO(), err => {
            if (err) {
                return next(err);
            }

            res.redirect('/qsos/new');
            req.db.close();
        });
    });

    router.get('/qsos', function (req, res, next) {

        let auxData = {};

        req.db.qsoCount(req.query, (err, count) => {
            if (err) {
                return next(err);
            }

            const pageSize = Math.abs(isNaN(parseInt(req.query.pageSize)) ? 25 : parseInt(req.query.pageSize));
            const pages = count % pageSize === 0 ? count / pageSize - 1 : Math.floor(count / pageSize);
            let page = pages;

            const requestedPage = parseInt(req.query.page);
            if (!isNaN(requestedPage) && 0 <= requestedPage && requestedPage <= pages) {
                page = requestedPage;
            }

            req.db.qsoSelect(Object.assign({ order: 'asc', page, pageSize }, req.query), (err, qsos) => {
                if (err) {
                    return next(err);
                }

                const filename = `qsos-${moment.utc().format('YYYYMMDDHHmmss')}.${req.query.fmt}`;
                if (req.query.dl === '1') {
                    res.set('Content-Disposition', `attachment; filename="${filename}"`);
                }

                switch (req.query.fmt) {

                    case 'adi':
                        const writer = new AdifWriter();
                        writer.pipe(res);
                        qsos.forEach(qso => writer.write(qso.toAO(auxData)));
                        writer.end();
                        req.db.close();
                        break;

                    case 'json':
                        res.json(qsos.map(qso => qso.toJSON()));
                        req.db.close();
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

                        const currentPage = page + 1;
                        const npages = pages + 1;

                        res.render('qso-list', { qsos, pageNav, currentPage, npages, count }, function (err, html) {
                            if (err) {
                                return next(err);
                            }
                            res.send(html);
                            req.db.close();
                        });
                        break;
                }
            });
        });
    });

    router.get('/qsos/:qso_id', function (req, res, next) {
        req.db.qsoSelectOne(req.params.qso_id, (err, qso) => {
            if (err) {
                return next(err);
            }

            if (req.query.form === 'edit') {
                qso = qso.toEdit();
            } else {
                qso = qso.toRender();
            }

            res.render(req.query.form === 'edit' ? 'qso-update' : 'qso-read', { qso }, function (err, html) {
                if (err) {
                    return next(err);
                }
                res.send(html);
                req.db.close();
            });

        });
    });

    router.put('/qsos/:qso_id', function (req, res, next) {

        req.db.qsoSelectOne(req.params.qso_id, (err, originalQso) => {
            if (err) {
                return next(err);
            }

            const inputQso = new QSO({
                timeon: `${req.body.date_on} ${req.body.time_on}.000Z`,
                timeoff: `${req.body.date_off} ${req.body.time_off}.000Z`,
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
            req.db.qsoUpdate(req.params.qso_id, qso, (err) => {
                if (err) {
                    return next(err);
                }
                res.redirect('/qsos');
                req.db.close();
            });
        });
    });

    router.delete('/qsos/:qso_id', function (req, res, next) {
        req.db.qsoDelete(req.params.qso_id, (err) => {
            if (err) {
                return next(err);
            }
            res.redirect('/qsos');
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

    return router;
}

module.exports = routerFactory;
