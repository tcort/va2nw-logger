'use strict';

const QSO = require('./QSO');
const async = require('async');
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
 * skcc - SKCC Member Number of Contacted Station - ADIF Fields: SKCC
 * name - Name of operator of Contacted Station - ADIF Fields: NAME
 * spc - State/Province/Country of Contacted Station - ADIF Fields: STATE
 * contest - Contest identifier - ADIF Fields: CONTEST_ID
 * stx - Contest exchange sent - ADIF Fields: STX_STRING
 * srx - Contest exchange received - ADIF Fields: SRX_STRING
 * contacted_op - Callsign of the individual operating the contacted station - ADIF Fields: CONTACTED_OP
 * pota - Parks on the Air Reference of Contacted Station - ADIF Fields: POTA_REF + SIG/SIG_INFO
 * my_pota - Parks on the Air Reference of Logging Station - ADIF Fields: MY_POTA_REF + MY_SIG/MY_SIG_INFO
 * sota - Summits on the Air Reference of Contacted Station - ADIF Fields: SOTA_REF + SIG/SIG_INFO
 * my_sota - Summits on the Air Reference of Logging Station - ADIF Fields: MY_SOTA_REF + MY_SIG/MY_SIG_INFO
 *
 * SKCC Roster
 * -----------
 * member_nr - SKCC member "number". May include level flags (C=centurion, T=tribune, S=senator)
 * callsign - callsign of the member.
 * name - name of the member.
 * spc - State/Province/Country of the member.
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
                station_callsign TEXT,
                skcc TEXT,
                name TEXT,
                spc TEXT,
                contest TEXT,
                stx TEXT,
                srx TEXT,
                contacted_op TEXT,
                pota TEXT,
                my_pota TEXT,
                sota TEXT,
                my_sota TEXT
            );
        `;

        this.#conn.run(table, [], err => {
            if (err) {
                return callback(err);
            }

            const table = `
                CREATE TABLE IF NOT EXISTS skcc_roster (
                    member_nr text,
                    callsign text,
                    name text,
                    spc text
                );
            `;

            this.#conn.run(table, [], err => {
                if (err) {
                    return callback(err);
                }
                callback();
            });
        });
    }

    #applySchemaChanges(callback) {
        const sql = 'PRAGMA table_info("qsos")';
        const vals = [ ];

        this.#conn.all(sql, vals, (err, table_info) => {
            if (err) {
                return callback(err);
            }

            /* TODO apply any shema changes here */

            callback();
        });
    }

    #freqToBandEdges(freq) {
        freq = parseFloat(freq);

        const result = [
            { band: "2190m", min: .1357, max: .1378 },
            { band: "630m", min: .472, max: .479 },
            { band: "560m", min: .501, max: .504 },
            { band: "160m", min: 1.8, max: 2.0 },
            { band: "80m", min: 3.5, max: 4.0 },
            { band: "60m", min: 5.06, max: 5.45 },
            { band: "40m", min: 7.0, max: 7.3 },
            { band: "30m", min: 10.1, max: 10.15 },
            { band: "20m", min: 14.0, max: 14.35 },
            { band: "17m", min: 18.068, max: 18.168 },
            { band: "15m", min: 21.0, max: 21.45 },
            { band: "12m", min: 24.890, max: 24.99 },
            { band: "10m", min: 28.0, max: 29.7 },
            { band: "8m", min: 40, max: 45 },
            { band: "6m", min: 50, max: 54 },
            { band: "5m", min: 54.000001, max: 69.9 },
            { band: "4m", min: 70, max: 71 },
            { band: "2m", min: 144, max: 148 },
            { band: "1.25m", min: 222, max: 225 },
            { band: "70cm", min: 420, max: 450 },
            { band: "33cm", min: 902, max: 928 },
            { band: "23cm", min: 1240, max: 1300 },
            { band: "13cm", min: 2300, max: 2450 },
            { band: "9cm", min: 3300, max: 3500 },
            { band: "6cm", min: 5650, max: 5925 },
            { band: "3cm", min: 10000, max: 10500 },
            { band: "1.25cm", min: 24000, max: 24250 },
            { band: "6mm", min: 47000, max: 47200 },
            { band: "4mm", min: 75500, max: 81000 },
            { band: "2.5mm", min: 119980, max: 123000 },
            { band: "2mm", min: 134000, max: 149000 },
            { band: "1mm", min: 241000, max: 250000 },
            { band: "submm", min: 300000, max: 7500000 },
        ].find(({ min, max, band }) => (min <= freq && freq <= max));

        return [ result.min, result.max ];
    }

    qsoUpsertAO(ao, callback) {

        const qso = QSO.fromAO(ao).toDBO();

        // has a qso id, so already exists
        if (qso.qso_id) {
            return this.qsoUpdate(qso.qso_id, qso, callback);
        }

        // +/- half an hour
        const timeon_before = moment(qso.timeon).subtract(30, 'minute').toJSON();
        const timeon_after = moment(qso.timeon).add(30, 'minute').toJSON();

        // same band
        const [ frequency_bottom_edge, frequency_top_edge ] =  this.#freqToBandEdges(qso.frequency);

        const sql = 'SELECT qso_id FROM qsos WHERE timeon >= ? AND timeon <= ? AND frequency >= ? AND frequency <= ? AND mode = ? AND callsign = ?';
        const vals = [ timeon_before, timeon_after, frequency_bottom_edge, frequency_top_edge, qso.mode, qso.callsign ];

        this.#conn.all(sql, vals, (err, matches) => {
            if (err) {
                return callback(err);
            } else if (matches.length === 0) {
                /* not in db, create it! */
                return this.qsoInsert(qso, callback);
            }
            /* update existing qso */
            this.qsoSelectOne(matches[0].qso_id, (err, old_qso) => {
                if (err) {
                    return callback(err);
                }

                const old_json = old_qso.toJSON();
                const new_json = QSO.fromAOtoJSON(ao);

                const merged_json = Object.assign({}, old_json, new_json);

                this.qsoUpdate(matches[0].qso_id, merged_json, callback);
            });
        });
    }

    qsoInsert(qso, callback) {

        const sql = 'INSERT INTO qsos (timeon, timeoff, frequency, mode, power, callsign, rst_sent, rst_rcvd, remarks, station_callsign, skcc, name, spc, contest, stx, srx, contacted_op, pota, my_pota, sota, my_sota) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.remarks, qso.station_callsign, qso.skcc, qso.name, qso.spc, qso.contest, qso.stx, qso.srx, qso.contacted_op, qso.pota, qso.my_pota, qso.sota, qso.my_sota ];

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

        const sql = 'UPDATE qsos SET timeon = ?, timeoff = ?, frequency = ?, mode = ?, power = ?, callsign = ?, rst_sent = ?, rst_rcvd = ?, remarks = ?, station_callsign = ?, skcc = ?, name = ?, spc = ?, contest = ?, stx = ?, srx = ?, contacted_op = ?, pota = ?, my_pota = ?, sota = ?, my_sota = ? WHERE qso_id = ?';
        const vals = [ qso.timeon, qso.timeoff, qso.frequency, qso.mode, qso.power, qso.callsign, qso.rst_sent, qso.rst_rcvd, qso.remarks, qso.station_callsign, qso.skcc, qso.name, qso.spc, qso.contest, qso.stx, qso.srx, qso.contacted_op, qso.pota, qso.my_pota, qso.sota, qso.my_sota, qso_id ];

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

    skccRosterUpdate(roster, callback) {
        this.#conn.run('DELETE FROM skcc_roster;', [], err => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(roster.split('\n').slice(1).map(line => line.split('|')).filter(member => member[0]?.length !== 0), (member, callback) => {
                const [ member_nr, callsign, name, city, spc, alt_callsigns, date_joined ] = member;

                const member_callsigns = [
                    callsign,
                ].concat(alt_callsigns.split(','))
                    .filter(callsign => callsign.length > 0)
                    .map(callsign => callsign.trim());

                async.eachSeries(member_callsigns, (member_callsign, callback) => {

                    this.#conn.run('INSERT INTO skcc_roster (member_nr, callsign, name, spc) VALUES (?, ?, ?, ?);', [ member_nr, member_callsign, name, spc ], err => {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });

                }, err => {
                    if (err) {
                        return callback(err);
                    }
                    callback();
                });

            }, err => {
                if (err) {
                    return callback(err);
                }
                callback();
            });
        });
    }

    skccRosterGetByCallsign(callsign, callback) {

        this.#conn.all('SELECT * FROM skcc_roster WHERE callsign = ?', [ callsign ], (err, members) => {
            if (err) {
                return callback(err);
            } else if (members.length === 0) {
                err = new Error('Not Found');
                err.callsign = callsign;
                err.status = 404;
                err.code = 'ENOENT';
                err.name = 'SKCC_MEMBER_NOT_FOUND';
                return callback(err);
            }

            callback(null, members[0]);
        });
    }

    close(callback = () => {}) {
        this.#conn.close();
        this.#conn = null;
        setImmediate(() => callback());
    }
}

module.exports = DB;
