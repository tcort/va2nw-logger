'use strict';

const CombUUID = require('comb-uuid');
const async = require('async');
const moment = require('moment');
const path = require('path');
const pkg = require('../package.json');
const sqlite3 = require('sqlite3');
const { QSO, defs, enums } = require('tcadif');

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

    insert(qso, callback) {

        qso = this.#fixupQso(qso);

        const cols = this.#cols;
        const sql = `INSERT INTO logs (${cols.map(col => '`' + col + '`').join(',')}) VALUES (${new Array(cols.length).fill('?').join(', ')});`;
        const vals = cols.map(col => typeof qso[col] === 'string' ? qso[col].trim() : qso[col]);

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    update(APP_TCADIF_QSO_ID, qso, callback) {
        qso = this.#fixupQso(qso);

        delete qso.DATE_CREATED; // don't clobber it

        const cols = Object.keys(qso).filter(col => this.#cols.includes(col));
        const sql = `UPDATE logs SET ${cols.map(col => '`' + col + '` = ?').join(', ')} WHERE APP_TCADIF_QSO_ID = ?;`;
        const vals = cols.map(col => typeof qso[col] === 'string' ? qso[col].trim() : qso[col]).concat(APP_TCADIF_QSO_ID);

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    upsert(qso, callback) {
        qso = this.#fixupQso(qso);
        this.findQsoId(qso.QSO_DATE, qso.TIME_ON, qso.CALL, qso.BAND, qso.MODE, (err, APP_TCADIF_QSO_ID) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    this.insert(qso, err => {
                        if (err) {
                            return callback(err);
                        }

                        callback();
                    });
                    return;
                }
                return callback(err); // some other db error
            }

            this.update(APP_TCADIF_QSO_ID, qso, err => {
                if (err) {
                    return callback(err);
                }

                callback();
            });
        });
    }

    rigs(callback) {
        const sql = 'SELECT DISTINCT MY_RIG FROM logs';
        const vals = [ ];

        this.#conn.all(sql, vals, (err, rows) => {
            if (err) {
                return callback(err);
            }

            callback(null, rows.map(row => row.MY_RIG).sort());
        });
    }

    antennas(callback) {
        const sql = 'SELECT DISTINCT MY_ANTENNA FROM logs';
        const vals = [ ];

        this.#conn.all(sql, vals, (err, rows) => {
            if (err) {
                return callback(err);
            }

            callback(null, rows.map(row => row.MY_ANTENNA).sort());
        });
    }

    select(query, callback) {

        // no query.since supplied
        if (!(typeof query.since === 'string' && query.since.length > 0)) {

            // year (and presumably others set)
            if (typeof query.SINCE_YEAR === 'string' && query.SINCE_YEAR.length > 0) {
                query.since = `${query.SINCE_YEAR ?? '1900'}-${query.SINCE_MONTH ?? '01'}-${query.SINCE_DAY ?? '01'}T${query.SINCE_HOUR ?? '00'}:${query.SINCE_MINUTE ?? '00'}:${query.SINCE_SECOND ?? '00'}Z`;
            } else {
                // else default to last month
                const start = moment.utc().subtract(1, 'month');
                query.since = start.format('YYYY-MM-DD') + 'T' + start.format('HH:mm:ss') + 'Z';
            }
        }

        // no query.before supplied
        if (!(typeof query.before === 'string' && query.before.length > 0)) {

            // year (and presumably others set)
            if (typeof query.BEFORE_YEAR === 'string' && query.BEFORE_YEAR.length > 0) {
                query.before = `${query.BEFORE_YEAR ?? '1900'}-${query.BEFORE_MONTH ?? '01'}-${query.BEFORE_DAY ?? '01'}T${query.BEFORE_HOUR ?? '00'}:${query.BEFORE_MINUTE ?? '00'}:${query.BEFORE_SECOND ?? '00'}Z`;
            } else {
                // else default to now
                const start = moment.utc();
                query.before = start.format('YYYY-MM-DD') + 'T' + start.format('HH:mm:ss') + 'Z';
            }
        }

        const sql = (query?.order === 'asc' ?
            'SELECT * FROM logs WHERE (TIMESTAMP BETWEEN ? AND ?) AND (CALL LIKE ?) ORDER BY APP_TCADIF_QSO_ID ASC LIMIT ?;' :
            'SELECT * FROM logs WHERE (TIMESTAMP BETWEEN ? AND ?) AND (CALL LIKE ?) ORDER BY APP_TCADIF_QSO_ID DESC LIMIT ?;');
        const vals = [
            query.since ?? '1900-01-01T00:00:00Z',
            query.before ?? '2099-12-31T23:59:59Z',
            typeof query.callsign === 'string' && query.callsign !== '' ? query.callsign : '%',
            !isNaN(parseInt(query.limit)) && parseInt(query.limit) > 0 ? parseInt(query.limit) : 1000000,
        ];

        this.#conn.all(sql, vals, (err, logs) => {
            if (err) {
                return callback(err);
            }

            logs.forEach(log => {
                log.DATE_HUMAN = this.#date_human(log);
                log.TIME_HUMAN = this.#time_human(log);
                log.TIMESTAMP = this.#createTimestamp(log);
            });

            callback(null, logs);
        });
    }

    selectOne(APP_TCADIF_QSO_ID, callback) {
        const sql = 'SELECT * FROM logs WHERE APP_TCADIF_QSO_ID = ?';
        const vals = [ APP_TCADIF_QSO_ID ];

        this.#conn.all(sql, vals, (err, logs) => {
            if (err) {
                return callback(err);
            } else if (logs.length === 0) {
                err = new Error('Not Found');
                err.APP_TCADIF_QSO_ID = APP_TCADIF_QSO_ID;
                err.status = 404;
                err.code = 'ENOENT';
                err.name = 'LOG_NOT_FOUND';
                return callback(err);
            }

            logs[0].DATE_HUMAN = this.#date_human(logs[0]);
            logs[0].TIME_HUMAN = this.#time_human(logs[0]);
            logs[0].TIMESTAMP = this.#createTimestamp(logs[0]);

            callback(null, logs[0]);
        });
    }

    findQsoId(QSO_DATE, TIME_ON, CALL, BAND, MODE, callback) {
        const sql = 'SELECT APP_TCADIF_QSO_ID FROM logs WHERE QSO_DATE = ? AND (TIME_ON = ? OR TIME_ON = ?) AND CALL = ? AND BAND = ? AND MODE = ?;';
        const vals = [ QSO_DATE, TIME_ON.slice(0, 4), TIME_ON.slice(0,6), CALL, BAND, MODE ];
        this.#conn.all(sql, vals, (err, logs) => {
            if (err) {
                return callback(err);
            } else if (logs.length === 0) {
                err = new Error('Not Found');
                err.sql = sql;
                err.vals = vals;
                err.status = 404;
                err.code = 'ENOENT';
                err.name = 'LOG_NOT_FOUND';
                return callback(err);
            }
            callback(null, logs[0].APP_TCADIF_QSO_ID);
        });
    }

    callsignStartsWith(partial, callback) {
        const sql = 'SELECT DISTINCT CALL FROM logs WHERE CALL LIKE ? LIMIT 10';
        const vals = [ partial + '%' ];

        this.#conn.all(sql, vals, (err, calls) => {
            if (err) {
                return callback(err);
            }

            const sql = 'SELECT DISTINCT CALL FROM skcc_roster WHERE CALL LIKE ? LIMIT 10';
            const vals = [ partial + '%' ];

            this.#conn.all(sql, vals, (err, skcc_calls) => {
                if (err) {
                    return callback(err);
                }
                const sql = 'SELECT DISTINCT CALL FROM master_scp WHERE CALL LIKE ? LIMIT 10';
                const vals = [ partial + '%' ];

                this.#conn.all(sql, vals, (err, scp_calls) => {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, [...new Set(calls.concat(skcc_calls).concat(scp_calls).map(row => row.CALL))].sort().slice(0,10));
                });
            });
        });
    }

    myAntennaStartsWith(partial, callback) {
        const sql = 'SELECT DISTINCT MY_ANTENNA FROM logs WHERE MY_ANTENNA LIKE ? LIMIT 10';
        const vals = [ partial + '%' ];

        this.#conn.all(sql, vals, (err, antennas) => {
            if (err) {
                return callback(err);
            }

            callback(null, antennas.map(row => row.MY_ANTENNA));
        });
    }

    myRigStartsWith(partial, callback) {
        const sql = 'SELECT DISTINCT MY_RIG FROM logs WHERE MY_RIG LIKE ? LIMIT 10';
        const vals = [ partial + '%' ];

        this.#conn.all(sql, vals, (err, rigs) => {
            if (err) {
                return callback(err);
            }

            callback(null, rigs.map(row => row.MY_RIG));
        });
    }

    close(callback) {
        this.#conn.close();
        this.#conn = null;
        setImmediate(() => callback());
    }

    #applySchemaChanges(callback) {

        async.waterfall([

            (callback) => {

                const sql = 'PRAGMA table_info("logs")';
                const vals = [ ];

                this.#conn.all(sql, vals, (err, rows) => {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, rows.map(row => row.name));
                });

            },

            (dbcols, callback) => {

                // rename old columns

                const rename_cols = [
                    { from: 'LOG_ID', to: 'APP_TCADIF_QSO_ID' },
                ].filter(mapping => dbcols.includes(mapping.from))

                async.map(rename_cols.map(mapping => `ALTER TABLE logs RENAME COLUMN \`${mapping.from}\` TO \`${mapping.to}\``), (sql, callback) => {

                    this.#conn.all(sql, [], (err, results) => {
                        if (err) {
                            return callback(err);
                        }

                        callback(null, results);
                    });

                }, (err, results) => {
                    if (err) {
                        return callback(err);
                    }

                    callback(null, dbcols);
                });

            },

            (dbcols, callback) => {

                // add new columns

                const additional_cols = this.#cols.filter(col => !dbcols.includes(col));

                async.map(additional_cols.map(col => `ALTER TABLE logs ADD COLUMN \`${col}\` text`), (sql, callback) => {

                    this.#conn.all(sql, [], (err, results) => {
                        if (err) {
                            return callback(err);
                        }

                        callback(null, results);
                    });

                }, (err, results) => {
                    if (err) {
                        return callback(err);
                    }

                    callback();
                });


            },
        ], err => {

            if (err) {
                return callback(err);
            }

            callback();
        });
    }

    updateMasterScp(roster, callback) {
        this.#conn.run('DELETE FROM master_scp;', [], err => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(roster.split('\n').filter(line => !line.startsWith('#')).map(line => line.trim()).filter(line => line !== ''), (callsign, callback) => {
                this.#conn.run('INSERT INTO master_scp (CALL) VALUES (?);', [callsign], err => {
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

    updateSkccRoster(roster, callback) {
        this.#conn.run('DELETE FROM skcc_roster;', [], err => {
            if (err) {
                return callback(err);
            }
            async.eachSeries(roster.split('\n').map(line => line.split('|')).filter(member => member[0]?.length !== 0), (member, callback) => {
                this.#conn.run('INSERT INTO skcc_roster (NR, CALL, NAME, CITY, STATE, ALT_CALLS, DATE_JOINED) VALUES (?, ?, ?, ?, ?, ?, ?);', member, err => {
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

    getSkccRosterMember(CALL, callback) {
        const sql = 'SELECT * FROM skcc_roster WHERE CALL = ?';
        const vals = [ CALL ];

        this.#conn.all(sql, vals, (err, members) => {
            if (err) {
                return callback(err);
            } else if (members.length === 0) {
                err = new Error('Not Found');
                err.CALL = CALL;
                err.status = 404;
                err.code = 'ENOENT';
                err.name = 'SKCC_MEMBER_NOT_FOUND';
                return callback(err);
            }

            callback(null, members[0]);
        });
    }

    #createTables(callback) {
        const cols = this.#cols.filter(col => col !== 'APP_TCADIF_QSO_ID').map(col => `    \`${col}\` text`).join(',\n');
        const schema = (`CREATE TABLE IF NOT EXISTS logs (\n    APP_TCADIF_QSO_ID text primary key,\n${cols}\n);`);
        this.#conn.run(schema, [], err => {
            if (err) {
                return callback(err);
            }

            const schema = 'CREATE TABLE IF NOT EXISTS skcc_roster ( NR text primary key, CALL text, NAME text, CITY text, STATE text, ALT_CALLS text, DATE_JOINED text );';
            this.#conn.run(schema, [], err => {
                if (err) {
                    return callback(err);
                }

                const schema = 'CREATE TABLE IF NOT EXISTS master_scp ( CALL text primary key );';
                this.#conn.run(schema, [], err => {
                    if (err) {
                        return callback(err);
                    }

                    this.#applySchemaChanges(callback);
                });
            });
        });
    }

    #createQsoId(qso) {
        return CombUUID.encode(this.#createTimestamp(qso));
    }

    #createTimestamp(qso) {

        const year = qso.QSO_DATE.slice(0, 4);
        const month = qso.QSO_DATE.slice(4, 6);
        const day = qso.QSO_DATE.slice(6, 8);

        const TIME_ON = qso.TIME_ON.length === 4 ? `${qso.TIME_ON}00` : qso.TIME_ON; /* normalize to 6 digit time */

        const hour = TIME_ON.slice(0, 2);
        const minute = TIME_ON.slice(2, 4);
        const second = TIME_ON.slice(4, 6);

        return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    }

    #date_human(qso) {
        return moment.utc(this.#createTimestamp(qso)).format('YYYY-MM-DD');
    }

    #time_human(qso) {
        return moment.utc(this.#createTimestamp(qso)).format('HH:mm');
    }

    get #cols() {
        return Object.keys(defs.qso).concat([ 'PROGRAMID', 'PROGRAMVERSION', 'TIMESTAMP', 'DATE_CREATED', 'DATE_UPDATED' ]);
    }

    #freq2band(freq) {
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

        return result?.band;
    }

    #fixupQso(qso) {
        qso = new QSO(qso).toObject();

        /* TODO extract these fixups into testable functions */

        qso.APP_TCADIF_QSO_ID = this.#createQsoId(qso);

        qso.TIMESTAMP = this.#createTimestamp(qso);
        qso.PROGRAMID = pkg.name;
        qso.PROGRAMVERSION = pkg.version;
        qso.DATE_CREATED = qso.DATE_UPDATED = (new Date()).toJSON();

        if (typeof qso.MY_POTA_REF === 'string' && qso.MY_POTA_REF !== '') { // has MY_POTA_REF? fill in MY_SIG MY_SIG_INFO
            qso.MY_SIG = 'POTA';
            qso.MY_SIG_INFO = qso.MY_POTA_REF;
        }

        if (typeof qso.POTA_REF === 'string' && qso.POTA_REF !== '') { // has POTA_REF? fill in SIG SIG_INFO
            qso.SIG = 'POTA';
            qso.SIG_INFO = qso.POTA_REF;
        }

        if (typeof qso.FREQ === 'string' && qso.FREQ !== '' && typeof qso.BAND !== 'string') {// has FREQ but no BAND? fill in band
            qso.BAND = this.#freq2band(qso.FREQ);
        }

        return qso;
    }

}

module.exports = DB;
