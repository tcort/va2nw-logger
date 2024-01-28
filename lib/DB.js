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
 * remarks - notes about the QSO - ADIF Field: NOTES
 * station_callsign - Call sign of logging station - ADIF Fields: STATION_CALLSIGN
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

            this.#createTables(err => {
                if (err) {
                    return callback(err);
                }

                this.#applySchemaChanges(err => {
                    if (err) {
                        return callback(err);
                    }
                    callback();
                });
            });
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
                remarks TEXT,
                station_callsign TEXT
            );
        `;

        this.#conn.run(table, [], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    #applySchemaChangeDropQslRcvd(table_info, callback) {

        // check if qsl_rcvd column exists
        if (!table_info.some(table_info => table_info.name === 'qsl_rcvd')) {
            return callback(); // exists, nothing to do here
        }

        // does not exist, add it after qso_id
        this.#conn.run('ALTER TABLE qsos DROP COLUMN qsl_rcvd;', [ ], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    #applySchemaChangeDropQslSent(table_info, callback) {

        // check if qsl_sent column exists
        if (!table_info.some(table_info => table_info.name === 'qsl_sent')) {
            return callback(); // exists, nothing to do here
        }

        // does not exist, add it after qso_id
        this.#conn.run('ALTER TABLE qsos DROP COLUMN qsl_sent;', [ ], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    #applySchemaChangeStationCallsign(table_info, callback) {

        // check if station_callsign column exists
        if (table_info.some(table_info => table_info.name === 'station_callsign')) {
            return callback(); // exists, nothing to do here
        }

        // does not exist, add it after qso_id
        this.#conn.run('ALTER TABLE qsos ADD COLUMN station_callsign TEXT;', [], err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    #applySchemaChanges(callback) {
        const sql = 'PRAGMA table_info("qsos")';
        const vals = [ ];

        this.#conn.all(sql, vals, (err, table_info) => {
            if (err) {
                return callback(err);
            }

            this.#applySchemaChangeStationCallsign(table_info, err => {
                if (err) {
                    return callback(err);
                }

                this.#applySchemaChangeDropQslSent(table_info, err => {
                    if (err) {
                        return callback(err);
                    }

                    this.#applySchemaChangeDropQslRcvd(table_info, err => {
                        if (err) {
                            return callback(err);
                        }

                        callback();
                    });
                });
            });
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

        const sql = 'INSERT INTO qsos (timeon, timeoff, frequency, mode, power, callsign, rst_sent, rst_rcvd, remarks, station_callsign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.remarks, qso.station_callsign ];

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    qsoUniqueStationCallsigns(callback) {
        const sql = 'SELECT DISTINCT station_callsign FROM qsos';
        const vals = [ ];

        this.#conn.all(sql, vals, (err, rows) => {
            if (err) {
                return callback(err);
            }

            callback(null, rows.map(row => row.station_callsign).sort());
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

        const sql = 'UPDATE qsos SET timeon = ?, timeoff = ?, frequency = ?, mode = ?, power = ?, callsign = ?, rst_sent = ?, rst_rcvd = ?, remarks = ?, station_callsign = ? WHERE qso_id = ?';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.remarks, qso.station_callsign, qso_id ];

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
                if (query.time_since.length === '23:59'.length) {
                    query.time_since += ':00';
                }
                query.since = `${query.date_since}T${query.time_since}.000Z`;
            }
        }

        // no query.before supplied
        if (!(typeof query.before === 'string' && query.before.length > 0)) {

            // year (and presumably others set)
            if (typeof query.year_before === 'string' && query.year_before.length > 0) {
                query.before = `${query.year_before ?? '2099'}-${query.month_before ?? '01'}-${query.day_before ?? '01'}T${query.hour_before ?? '00'}:${query.minute_before ?? '00'}:${query.second_before ?? '00'}.000Z`;
            }

            if (typeof query.date_before === 'string' && query.date_before !== '' && typeof query.time_before === 'string' && query.time_before !== '') {
                if (query.time_before.length === '23:59'.length) {
                    query.time_before += ':00';
                }
                query.before = `${query.date_before}T${query.time_before}.000Z`;
            }
        }

        const sql = 'SELECT COUNT(*) AS count FROM qsos WHERE (timeon BETWEEN ? AND ?) AND (callsign LIKE ?) AND (IFNULL(STATION_CALLSIGN,"") LIKE ?) AND (IFNULL(remarks,"") LIKE ?);';
        const vals = [
            query.since ?? '1900-01-01T00:00:00.000Z',
            query.before ?? '2099-12-31T23:59:59.000Z',
            typeof query.callsign === 'string' && query.callsign !== '' ? query.callsign : '%',
            typeof query.station_callsign === 'string' && query.station_callsign !== '' ? query.station_callsign : '%',
            typeof query.remarks === 'string' && query.remarks !== '' ? `%${query.remarks}%` : '%',
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
                if (query.time_since.length === '23:59'.length) {
                    query.time_since += ':00';
                }
                query.since = `${query.date_since}T${query.time_since}.000Z`;
            }
        }

        // no query.before supplied
        if (!(typeof query.before === 'string' && query.before.length > 0)) {

            // year (and presumably others set)
            if (typeof query.year_before === 'string' && query.year_before.length > 0) {
                query.before = `${query.year_before ?? '2099'}-${query.month_before ?? '01'}-${query.day_before ?? '01'}T${query.hour_before ?? '00'}:${query.minute_before ?? '00'}:${query.second_before ?? '00'}.000Z`;
            }

            if (typeof query.date_before === 'string' && query.date_before !== '' && typeof query.time_before === 'string' && query.time_before !== '') {
                if (query.time_before.length === '23:59'.length) {
                    query.time_before += ':00';
                }
                query.before = `${query.date_before}T${query.time_before}.000Z`;
            }
        }

        const sql = (query?.order === 'asc' ?
            'SELECT * FROM qsos WHERE (timeon BETWEEN ? AND ?) AND (callsign LIKE ?) AND (IFNULL(STATION_CALLSIGN,"") LIKE ?) AND (IFNULL(remarks,"") LIKE ?) ORDER BY timeon ASC  LIMIT ?, ?;' :
            'SELECT * FROM qsos WHERE (timeon BETWEEN ? AND ?) AND (callsign LIKE ?) AND (IFNULL(STATION_CALLSIGN,"") LIKE ?) AND (IFNULL(remarks,"") LIKE ?) ORDER BY timeon DESC LIMIT ?, ?;');
        const vals = [
            query.since ?? '1900-01-01T00:00:00.000Z',
            query.before ?? '2099-12-31T23:59:59.000Z',
            typeof query.callsign === 'string' && query.callsign !== '' ? query.callsign : '%',
            typeof query.station_callsign === 'string' && query.station_callsign !== '' ? query.station_callsign : '%',
            typeof query.remarks === 'string' && query.remarks !== '' ? `%${query.remarks}%` : '%',
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
