'use strict';

const CombUUID = require('comb-uuid');
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

        qso.LOG_ID = this.#createLogId(qso);

        qso.TIMESTAMP = this.#createTimestamp(qso);
        qso.PROGRAMID = pkg.name;
        qso.PROGRAMVERSION = pkg.version;
        qso.DATE_CREATED = qso.DATE_UPDATED = (new Date()).toJSON();

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

    select(query, callback) {
        const sql = 'SELECT * FROM logs WHERE (TIMESTAMP BETWEEN ? AND ?) AND (CALL LIKE ?) ORDER BY LOG_ID DESC;';
        const vals = [ query.since ?? '1900-01-01T00:00:00Z', query.before ?? '2900-01-01T00:00:00Z', query.callsign ?? '%' ];

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

}

module.exports = DB;
