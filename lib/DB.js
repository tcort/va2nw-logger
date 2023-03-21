'use strict';

const CombUUID = require('comb-uuid');
const async = require('async');
const moment = require('moment');
const path = require('path');
const pkg = require('../package.json');
const sqlite3 = require('sqlite3');
const { QSO, defs } = require('tcadif');

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

        qso = new QSO(qso).toObject();

        /* TODO extract these fixups into testable functions */

        qso.LOG_ID = this.#createLogId(qso);

        qso.TIMESTAMP = this.#createTimestamp(qso);
        qso.PROGRAMID = pkg.name;
        qso.PROGRAMVERSION = pkg.version;
        qso.DATE_CREATED = qso.DATE_UPDATED = (new Date()).toJSON();

        if (typeof qso.MY_POTA_REF === 'string' && qso.MY_POTA_REF !== '') { // has MY_POTA_REF? fill in MY_SIG MY_SIG_INFO
            qso.MY_SIG = 'POTA';
            qso.MY_SIG_INFO = qso.POTA_REF;
        }

        if (typeof qso.POTA_REF === 'string' && qso.POTA_REF !== '') { // has POTA_REF? fill in SIG SIG_INFO
            qso.SIG = 'POTA';
            qso.SIG_INFO = qso.POTA_REF;
        }

        if (typeof qso.FREQ === 'string' && qso.FREQ !== '' && typeof qso.BAND !== 'string') {// has FREQ but no BAND? fill in band
            qso.BAND = this.#freq2band(qso.FREQ);
        }

        const cols = [ 'LOG_ID' ].concat(this.#cols)
        const sql = `INSERT INTO logs (${cols.map(col => '`' + col + '`').join(',')}) VALUES (${new Array(cols.length).fill('?').join(', ')});`;
        const vals = cols.map(col => qso[col]);

        this.#conn.run(sql, vals, err => {
            if (err) {
                return callback(err);
            }

            callback();
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
            if (typeof query.YEAR === 'string' && query.YEAR.length > 0) {
                query.since = `${query.YEAR ?? '1900'}-${query.MONTH ?? '01'}-${query.DAY ?? '01'}T${query.HOUR ?? '00'}:${query.MINUTE ?? '00'}:${query.SECOND ?? '00'}Z`;
            } else {

                // else default to last month
                const start = moment().subtract(1, 'month');
                query.since = start.format('YYYY-MM-DD') + 'T' + start.format('HH:mm:ss') + 'Z';

                // limit not set? set it high so we get everything from last 30 days
                if (!(typeof query.limit === 'string' && query.limit.length > 0)) {
                    query.limit = 1000000;
                }
            }
        }

        const sql = 'SELECT * FROM logs WHERE (TIMESTAMP BETWEEN ? AND ?) AND (CALL LIKE ?) ORDER BY LOG_ID DESC LIMIT ?;';
        const vals = [
            query.since ?? '1900-01-01T00:00:00Z',
            query.before ?? '2900-01-01T00:00:00Z',
            typeof query.callsign === 'string' && query.callsign !== '' ? query.callsign : '%',
            !isNaN(parseInt(query.limit)) && parseInt(query.limit) > 0 ? parseInt(query.limit) : 100,
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

    selectOne(LOG_ID, callback) {
        const sql = 'SELECT * FROM logs WHERE LOG_ID = ?';
        const vals = [ LOG_ID ];

        this.#conn.all(sql, vals, (err, logs) => {
            if (err) {
                return callback(err);
            } else if (logs.length === 0) {
                err = new Error('Not Found');
                err.LOG_ID = LOG_ID;
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

    stats(callback) {

        async.map([
            "SELECT BAND, COUNT(*) QSO_PER_BAND FROM logs GROUP BY BAND ORDER BY BAND;",
            "SELECT MODE, COUNT(*) QSO_PER_MODE FROM logs GROUP BY MODE ORDER BY MODE;",
            "SELECT COUNT(*) QSO_TOTAL, COUNT(DISTINCT CALL) QSO_UNIQUE_CALL_TOTAL, COUNT(DISTINCT SKCC) UNIQUE_SKCC_NR, COUNT(SKCC <> '') QSO_SKCC_TOTAL, COUNT(MY_POTA_REF <> '' OR POTA_REF <> '') QSO_POTA_TOTAL FROM logs;",
            "SELECT STRFTIME('%Y', TIMESTAMP) YEAR, COUNT(*) QSO_PER_YEAR FROM logs GROUP BY YEAR;",
            "SELECT STRFTIME('%m', TIMESTAMP) MONTH, COUNT(*) QSO_PER_MONTH FROM logs GROUP BY MONTH;",
            "SELECT STRFTIME('%w', TIMESTAMP) DAY_OF_WEEK, COUNT(*) QSO_PER_DAY_OF_WEEK FROM logs GROUP BY DAY_OF_WEEK;",
            "SELECT CALL, COUNT(*) CNT FROM logs GROUP BY CALL ORDER BY CNT DESC LIMIT 10",
            "SELECT MIN(TIMESTAMP) FIRST_QSO, MAX(TIMESTAMP) LAST_QSO FROM logs;",
            "SELECT MY_POTA_REF, COUNT(DISTINCT QSO_DATE) NACTIVATIONS FROM logs WHERE MY_POTA_REF <> '' GROUP BY MY_POTA_REF ORDER BY NACTIVATIONS DESC;",
        ], (sql, callback) => {

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

            const [ bands, modes, total_qso, years, months, daysofweek, frequent_flyers, bookends, pota_activations ] = results;

            const stats = {
                modes: modes.map(mode => {
                    mode.PERCENT = (100.0 * parseFloat(mode.QSO_PER_MODE) / parseFloat(total_qso[0].QSO_TOTAL)).toFixed(2);
                    return mode;
                }),
                bands: bands.map(band => {
                    band.PERCENT = (100.0 * parseFloat(band.QSO_PER_BAND) / parseFloat(total_qso[0].QSO_TOTAL)).toFixed(2);
                    return band;
                }),
                years: years.map(year => {
                    year.PERCENT = (100.0 * parseFloat(year.QSO_PER_YEAR) / parseFloat(total_qso[0].QSO_TOTAL)).toFixed(2);
                    return year;
                }),
                months: months.map(month => {
                    month.MONTH = moment(month.MONTH, 'MM').format('MMMM');
                    month.PERCENT = (100.0 * parseFloat(month.QSO_PER_MONTH) / parseFloat(total_qso[0].QSO_TOTAL)).toFixed(2);
                    return month;
                }),
                daysofweek: daysofweek.map(dayofweek => {
                    dayofweek.DAY_OF_WEEK = moment(dayofweek.DAY_OF_WEEK, 'e').format('dddd');
                    dayofweek.PERCENT = (100.0 * parseFloat(dayofweek.QSO_PER_DAY_OF_WEEK) / parseFloat(total_qso[0].QSO_TOTAL)).toFixed(2);
                    return dayofweek;
                }),
                nqso: total_qso[0].QSO_TOTAL,
                ncallsigns: total_qso[0].QSO_UNIQUE_CALL_TOTAL,
                nskcc_unique: total_qso[0].UNIQUE_SKCC_NR,
                npota: total_qso[0].QSO_POTA_TOTAL,
                nskcc: total_qso[0].QSO_SKCC_TOTAL,
                frequent_flyers: frequent_flyers,
                first_qso: moment(bookends[0].FIRST_QSO).format('LL'),
                last_qso: moment(bookends[0].LAST_QSO).format('LL'),
                qso_per_day: (parseFloat(total_qso[0].QSO_TOTAL) / moment.duration(moment(bookends[0].LAST_QSO).diff(moment(bookends[0].FIRST_QSO))).asDays()).toFixed(2),
                pota_activations: pota_activations,
            };
            callback(null, stats);
        });
    }

    close(callback) {
        this.#conn.close();
        this.#conn = null;
        setImmediate(() => callback());
    }

    #createTables(callback) {
        const cols = this.#cols.map(col => `    \`${col}\` text`).join(',\n');
        const schema = (`CREATE TABLE IF NOT EXISTS logs (\n    LOG_ID text primary key,\n${cols}\n);`);
        this.#conn.run(schema, [], err => {
            if (err) {
                return callback(err);
            }
            callback();
        });
    }

    #createLogId(qso) {
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
        return moment.utc(this.#createTimestamp(qso)).format('LL');
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
}

module.exports = DB;
