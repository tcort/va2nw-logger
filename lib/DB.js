'use strict';

const QSO = require('./QSO');
const moment = require('moment');
const path = require('path');
const sqlite3 = require('sqlite3');

/*
 * Database Layout
 *
 * QSOs
 * ----
 * qso_id - uniquely identifies this qso - internal use only
 * timeon - Start of QSO ISO8601 Timestamp - ADIF Fields: QSO_DATE, TIME_ON
 * timeoff - End of QSO ISO8601 Timestamp - ADIF Fields: QSO_DATE_OFF, TIME_OFF
 * frequency - Numeric Frequency in MHz - ADIF Fields: FREQ
 * mode - Mode of operation (CW, SSB, etc) - ADIF Fields: MODE
 * power - Output power in Watts - ADIF Fields: TX_PWR
 * callsign - Call sign of station worked - ADIF Fields: CALL
 * rst_sent - Signal report of the station worked - ADIF Field: RST_SENT
 * rst_rcvd - Signal report of the logging station - ADIF Field: RST_RCVD
 * qsl_sent - QSL Card sent to station worked - ADIF Field QSL_SENT
 * qsl_rcvd - QSL Card received by logging station - ADIF Field: QSL_RCVD
 * remarks - notes about the QSO - ADIF Field: NOTES
 */

class DB {

    #file;
    #conn;

    constructor(file) {
        this.#file = file ?? path.join(__dirname, '..', 'logbook.sqlite3');
    }

    open(callback) {
        this.#conn = new sqlite3.Database(this.#file, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_FULLMUTEX, err => {
            if (err) {
                return callback(err);
            }

            this.#createTables(callback);
        });
    }

    #createTables(callback) {
        const table = `
            CREATE TABLE IF NOT EXISTS qsos (
                qso_id INTEGER PRIMARY KEY AUTOINCREMENT,
                timeon TEXT,
                timeoff TEXT,
                frequency NUMERIC,
                mode TEXT,
                power NUMERIC,
                callsign TEXT,
                rst_sent TEXT,
                rst_rcvd TEXT,
                qsl_sent BOOLEAN,
                qsl_rcvd BOOLEAN,
                remarks TEXT
            );
        `;

        this.#conn.run(table, [], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    qsoUpsert(qso, callback) {

        if (qso.qso_id) {
            return this.qsoUpdate(qso.qso_id, qso, callback);
        }

        const sql = 'SELECT qso_id FROM qsos WHERE timeon = ? AND frequency = ? AND mode = ? AND callsign = ?';
        const vals = [ qso.timeon, qso.frequency, qso.mode, qso.callsign ];

        this.#conn.all(sql, vals, (err, matches) => {
            if (err) {
                return callback(err);
            } else if (matches.length === 0) {
                return this.qsoInsert(qso, callback);
            } else {
                return this.qsoUpdate(matches[0].qso_id, qso, callback);
            }
        });
    }

    qsoInsert(qso, callback) {

        const sql = 'INSERT INTO qsos (timeon, timeoff, frequency, mode, power, callsign, rst_sent, rst_rcvd, qsl_sent, qsl_rcvd, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.qsl_sent, qso.qsl_rcvd, qso.remarks ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    qsoDelete(qso_id, callback) {

        const sql = 'DELETE FROM qsos WHERE qso_id = ?';
        const vals = [ qso_id ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    qsoUpdate(qso_id, qso, callback) {

        const sql = 'UPDATE qsos SET timeon = ?, timeoff = ?, frequency = ?, mode = ?, power = ?, callsign = ?, rst_sent = ?, rst_rcvd = ?, qsl_sent = ?, qsl_rcvd = ?, remarks = ? WHERE qso_id = ?';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.qsl_sent, qso.qsl_rcvd, qso.remarks, qso_id ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });

    }

    qsoCount(query, callback) {

        // no query.since supplied
        if (!(typeof query.since === 'string' && query.since.length > 0)) {

            // year (and presumably others set)
            if (typeof query.year_since === 'string' && query.year_since.length > 0) {
                query.since = `${query.year_since ?? '1900'}-${query.month_since ?? '01'}-${query.day_since ?? '01'}T${query.hour_since ?? '00'}:${query.minute_since ?? '00'}:${query.second_since ?? '00'}.000Z`;
            }

            if (typeof query.date_since === 'string' && query.date_since !== '' && typeof query.time_since === 'string' && query.time_since !== '') {
                query.since = `${query.date_since} ${query.time_since}`;
            }
        }

        // no query.before supplied
        if (!(typeof query.before === 'string' && query.before.length > 0)) {

            // year (and presumably others set)
            if (typeof query.year_before === 'string' && query.year_before.length > 0) {
                query.before = `${query.year_before ?? '2099'}-${query.month_before ?? '01'}-${query.day_before ?? '01'}T${query.hour_before ?? '00'}:${query.minute_before ?? '00'}:${query.second_before ?? '00'}.000Z`;
            }

            if (typeof query.date_before === 'string' && query.date_before !== '' && typeof query.time_before === 'string' && query.time_before !== '') {
                query.since = `${query.date_before} ${query.time_before}`;
            }
        }

        const sql = 'SELECT COUNT(*) AS count FROM qsos WHERE (timeon BETWEEN ? AND ?);';
        const vals = [
            query.since ?? '1900-01-01T00:00:00.000Z',
            query.before ?? '2099-12-31T23:59:59.000Z',
        ];

        this.#conn.all(sql, vals, (err, counts) => {
            if (err) {
                return callback(err);
            }

            callback(null, counts[0].count);
        });
    }

    qsoSelectOne(qso_id, callback) {
        const sql = 'SELECT * FROM qsos WHERE qso_id = ?;';
        const vals = [ qso_id ];

        this.#conn.all(sql, vals, (err, qsos) => {
            if (err) {
                return callback(err);
            }

            qsos = qsos.map(qso => QSO.fromDBO(qso));

            callback(null, qsos[0]);
        });
    }

    qsoSelect(query, callback) {
        const limit = (query.pageSize ?? 1000000);
        const offset = (query.page ?? 0) * limit;

        // no query.since supplied
        if (!(typeof query.since === 'string' && query.since.length > 0)) {

            // year (and presumably others set)
            if (typeof query.year_since === 'string' && query.year_since.length > 0) {
                query.since = `${query.year_since ?? '1900'}-${query.month_since ?? '01'}-${query.day_since ?? '01'}T${query.hour_since ?? '00'}:${query.minute_since ?? '00'}:${query.second_since ?? '00'}.000Z`;
            }

            if (typeof query.date_since === 'string' && query.date_since !== '' && typeof query.time_since === 'string' && query.time_since !== '') {
                query.since = `${query.date_since} ${query.time_since}`;
            }
        }

        // no query.before supplied
        if (!(typeof query.before === 'string' && query.before.length > 0)) {

            // year (and presumably others set)
            if (typeof query.year_before === 'string' && query.year_before.length > 0) {
                query.before = `${query.year_before ?? '2099'}-${query.month_before ?? '01'}-${query.day_before ?? '01'}T${query.hour_before ?? '00'}:${query.minute_before ?? '00'}:${query.second_before ?? '00'}.000Z`;
            }

            if (typeof query.date_before === 'string' && query.date_before !== '' && typeof query.time_before === 'string' && query.time_before !== '') {
                query.since = `${query.date_before} ${query.time_before}`;
            }
        }

        const sql = (query?.order === 'asc' ?
            'SELECT * FROM qsos WHERE (timeon BETWEEN ? AND ?) ORDER BY timeon ASC LIMIT ?, ?;' :
            'SELECT * FROM qsos WHERE (timeon BETWEEN ? AND ?) ORDER BY timeon DESC LIMIT ?, ?;');
        const vals = [
            query.since ?? '1900-01-01T00:00:00.000Z',
            query.before ?? '2099-12-31T23:59:59.000Z',
            offset, limit,
        ];

        this.#conn.all(sql, vals, (err, qsos) => {
            if (err) {
                return callback(err);
            }

            qsos = qsos.map(qso => QSO.fromDBO(qso));

            callback(null, qsos);
        });
    }

    close(callback = () => {}) {
        this.#conn.close();
        this.#conn = null;
        setImmediate(() => callback());
    }
}

module.exports = DB;
