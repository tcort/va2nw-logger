'use strict';

const QSO = require('./QSO');
const path = require('path');
const sqlite3 = require('sqlite3');

/*
 * Database Layout
 *
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
        const schema = (`
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
        `);
        this.#conn.run(schema, [], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    upsert(qso, callback) {

        if (qso.qso_id) {
            return this.update(qso.qso_id, qso, callback);
        }

        const sql = 'SELECT qso_id FROM qsos WHERE timeon = ? AND frequency = ? AND mode = ? AND callsign = ?';
        const vals = [ qso.timeon, qso.frequency, qso.mode, qso.callsign ];

        this.#conn.all(sql, vals, (err, matches) => {
            if (err) {
                return callback(err);
            } else if (matches.length === 0) {
                return this.insert(qso, callback);
            } else {
                return this.update(matches[0].qso_id, qso, callback);
            }
        });
    }

    insert(qso, callback) {

        const sql = 'INSERT INTO qsos (timeon, timeoff, frequency, mode, power, callsign, rst_sent, rst_rcvd, qsl_sent, qsl_rcvd, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.qsl_sent, qso.qsl_rcvd, qso.remarks ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    delete(qso_id, callback) {

        const sql = 'DELETE FROM qsos WHERE qso_id = ?';
        const vals = [ qso_id ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    update(qso_id, qso, callback) {

        const sql = 'UPDATE qsos SET timeon = ?, timeoff = ?, frequency = ?, mode = ?, power = ?, callsign = ?, rst_sent = ?, rst_rcvd = ?, qsl_sent = ?, qsl_rcvd = ?, remarks = ? WHERE qso_id = ?';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.qsl_sent, qso.qsl_rcvd, qso.remarks, qso_id ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });

    }

    countQsos(callback) {
        const sql = 'SELECT COUNT(*) AS count FROM qsos;';
        const vals = [];

        this.#conn.all(sql, vals, (err, counts) => {
            if (err) {
                return callback(err);
            }

            callback(null, counts[0].count);
        });
    }

    selectOne(qso_id, callback) {
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

    select(page, pageSize, callback) {
        const limit = pageSize;
        const offset = page * pageSize;
        const sql = 'SELECT * FROM qsos ORDER BY timeon ASC LIMIT ?, ?';
        const vals = [ offset, limit ];
console.log(limit, offset);
        this.#conn.all(sql, vals, (err, qsos) => {
            if (err) {
                return callback(err);
            }

            qsos = qsos.map(qso => QSO.fromDBO(qso));

            callback(null, qsos);
        });
    }

    close(callback) {
        this.#conn.close();
        this.#conn = null;
        setImmediate(() => callback());
    }
}

module.exports = DB;
