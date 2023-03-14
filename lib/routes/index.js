'use strict';

const { AdifReader, AdifWriter } = require('tcadif');
const CombUUID = require('comb-uuid');
const DB = require('../DB');
const Stats = require('../Stats');
const bytes = require('bytes');
const express = require('express');
const fileUpload = require('express-fileupload');
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

router.use(function (req, res, next) {

    req.db = new DB();

    req.db.open(err => {
        if (err) {
            return next(err);
        }
        next();
    });
});

router.post('/logs', function (req, res, next) {

    if (req.is('multipart/form-data')) {
        if (!req.files || !req.files.adif_file) {
            const err = new Error('file not found');
            return next(err);
        }

        const adif = req.files.adif_file.data.toString();
        const reader = new AdifReader();

        reader.on('data', qso => {
            req.db.insert(qso, (err) => {
                if (err) {
                    console.log(err);
                }
            });
        });
        reader.on('error', err => next(err));
        reader.on('finish', () => {
            res.redirect('/logs');
            next();
        });

        reader.write(adif);
        reader.end();
        return;
    }

    req.body.QSO_DATE = `${req.body.YEAR}${req.body.MONTH}${req.body.DAY}`;
    req.body.TIME_ON = `${req.body.HOUR}${req.body.MINUTE}${req.body.SECOND}`;

    const qso = Object.fromEntries(Object.entries(req.body).filter(([ key, value ]) => value !== ''));

    req.db.insert(qso, err => {
        if (err) {
            return next(err);
        }
        res.redirect('/logs');
        next();
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
                break;
            case 'json':
                res.json(logs);
                break;
            default:
                const stats = Stats.compute(logs);
                res.render('logs', { logs, stats });
                break;
        }

        next();
    });
});


router.get('/logs/:LOG_ID', function (req, res, next) {

    req.db.selectOne(req.params.LOG_ID, (err, log) => {
        if (err) {
            return next(err);
        }

        res.render('log', { log });
        next();
    });
});


router.use(function (req, res, next) {
    req.db.close(err => {
        req.db = null;
        if (err) {
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
