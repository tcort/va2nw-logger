'use strict';

const moment = require('moment');

class QSO {

    #qso_id;
    #timeon;
    #timeoff;
    #frequency;
    #mode;
    #power;
    #callsign;
    #rst_sent;
    #rst_rcvd;
    #remarks;
    #station_callsign;
    #skcc;
    #name;
    #spc;
    #contest;
    #stx;
    #srx;
    #contacted_op;

    constructor(data = {}) {
        this.#qso_id = data?.qso_id;
        this.#timeon = data?.timeon ? new Date(data.timeon) : new Date();
        this.#timeoff = data?.timeoff ? new Date(data.timeoff) : new Date(this.#timeon.toJSON());
        this.#frequency = data?.frequency ?? 0;
        this.#mode = data?.mode ?? 'CW';
        this.#power = data?.power ?? 0;
        this.#callsign = data?.callsign ?? '';
        this.#rst_sent = data?.rst_sent ?? (this.#mode === 'CW' ? '599' : '59');
        this.#rst_rcvd = data?.rst_rcvd ?? (this.#mode === 'CW' ? '599' : '59');
        this.#remarks = data?.remarks ?? '';
        this.#station_callsign = data?.station_callsign ?? '';
        this.#skcc = data?.skcc ?? '';
        this.#name = data?.name ?? '';
        this.#spc = data?.spc ?? '';
        this.#contest = data?.contest ?? '';
        this.#stx = data?.stx ?? '';
        this.#srx = data?.srx ?? '';
        this.#contacted_op = data?.contacted_op ?? '';
    }

    toRender() {
        return {
            qso_id: this.#qso_id,
            dateon: moment(this.#timeon).utc().format('YYYY-MM-DD'),
            timeon: moment(this.#timeon).utc().format('HH:mm:ss'),
            dateoff: moment(this.#timeoff).utc().format('YYYY-MM-DD'),
            timeoff: moment(this.#timeoff).utc().format('HH:mm:ss'),
            frequency: this.#frequency.toFixed(3),
            band: this.#freqToBand(this.#frequency),
            mode: this.#mode,
            power: this.#power,
            callsign: this.#callsign,
            rst_sent: this.#rst_sent,
            rst_rcvd: this.#rst_rcvd,
            remarks: this.#remarks,
            station_callsign: this.#station_callsign,
            skcc: this.#skcc,
            name: this.#name,
            spc: this.#spc,
            contest: this.#contest,
            stx: this.#stx,
            srx: this.#srx,
            contacted_op: this.#contacted_op,
        };
    }

    toEdit() {
        return {
            qso_id: this.#qso_id,
            date_on: moment(this.#timeon).utc().format('YYYY-MM-DD'),
            time_on: moment(this.#timeon).utc().format('HH:mm:ss'),
            date_off: moment(this.#timeoff).utc().format('YYYY-MM-DD'),
            time_off: moment(this.#timeoff).utc().format('HH:mm:ss'),
            frequency: this.#frequency.toFixed(3),
            mode: this.#mode,
            power: this.#power,
            callsign: this.#callsign,
            rst_sent: this.#rst_sent,
            rst_rcvd: this.#rst_rcvd,
            remarks: this.#remarks,
            station_callsign: this.#station_callsign,
            skcc: this.#skcc,
            name: this.#name,
            spc: this.#spc,
            contest: this.#contest,
            stx: this.#stx,
            srx: this.#srx,
            contacted_op: this.#contacted_op,
        };
    }

    toJSON() {
        return {
            qso_id: this.#qso_id,
            timeon: this.#timeon.toJSON(),
            timeoff: this.#timeoff.toJSON(),
            frequency: this.#frequency,
            mode: this.#mode,
            power: this.#power,
            callsign: this.#callsign,
            rst_sent: this.#rst_sent,
            rst_rcvd: this.#rst_rcvd,
            remarks: this.#remarks,
            station_callsign: this.#station_callsign,
            skcc: this.#skcc,
            name: this.#name,
            spc: this.#spc,
            contest: this.#contest,
            stx: this.#stx,
            srx: this.#srx,
            contacted_op: this.#contacted_op,
        };
    }

    toDBO() {
        return {
            qso_id: this.#qso_id,
            timeon: this.#timeon.toJSON(),
            timeoff: this.#timeoff.toJSON(),
            frequency: this.#frequency,
            mode: this.#mode,
            power: this.#power,
            callsign: this.#callsign,
            rst_sent: this.#rst_sent,
            rst_rcvd: this.#rst_rcvd,
            remarks: this.#remarks,
            station_callsign: this.#station_callsign,
            skcc: this.#skcc,
            name: this.#name,
            spc: this.#spc,
            contest: this.#contest,
            stx: this.#stx,
            srx: this.#srx,
            contacted_op: this.#contacted_op,
        };
    }

    static fromDBO(dbo) {
        return new QSO({
            qso_id: dbo.qso_id,
            timeon: new Date(dbo.timeon),
            timeoff: new Date(dbo.timeoff),
            frequency: dbo.frequency,
            mode: dbo.mode,
            power: dbo.power,
            callsign: dbo.callsign,
            rst_sent: dbo.rst_sent,
            rst_rcvd: dbo.rst_rcvd,
            remarks: dbo.remarks,
            station_callsign: dbo.station_callsign,
            skcc: dbo.skcc,
            name: dbo.name,
            spc: dbo.spc,
            contest: dbo.contest,
            stx: dbo.stx,
            srx: dbo.srx,
            contacted_op: dbo.contacted_op,
        });
    }

    toAO(auxData = {}) {
        return Object.assign({}, auxData, {
            QSO_DATE: moment(this.#timeon).utc().format('YYYYMMDD'),
            TIME_ON: moment(this.#timeon).utc().format('HHmmss'),
            QSO_DATE_OFF: moment(this.#timeoff).utc().format('YYYYMMDD'),
            TIME_OFF: moment(this.#timeoff).utc().format('HHmmss'),
            FREQ: `${this.#frequency}`,
            BAND: this.#freqToBand(this.#frequency),
            MODE: this.#mode,
            TX_PWR: `${this.#power}`,
            CALL: this.#callsign,
            RST_SENT: `${this.#rst_sent}`,
            RST_RCVD: `${this.#rst_rcvd}`,
            NOTES: this.#remarks,
            STATION_CALLSIGN: this.#station_callsign,
            SKCC: this.#skcc,
            NAME: this.#name,
            SPC: this.#spc,
            CONTEST_ID: this.#contest,
            STX_STRING: this.#stx,
            SRX_STRING: this.#srx,
            CONTACTED_OP: this.#contacted_op,
        });
    }

    static fromAOtoJSON(ao) {
        const json = {};

        if (ao.QSO_DATE && ao.TIME_ON) {
            json.timeon = QSO.#createTimestamp(ao.QSO_DATE, ao.TIME_ON);
        }

        if (ao.QSO_DATE_OFF && ao.TIME_OFF) {
            json.timeoff = QSO.#createTimestamp(ao.QSO_DATE_OFF ? ao.QSO_DATE_OFF : ao.QSO_DATE, ao.TIME_OFF ? ao.TIME_OFF : ao.TIME_ON);
        }

        [
            [ 'FREQ', 'frequency' ],
            [ 'MODE', 'mode' ],
            [ 'TX_PWR', 'power' ],
            [ 'CALL', 'callsign' ],
            [ 'RST_SENT', 'rst_sent' ],
            [ 'RST_RCVD', 'rst_rcvd' ],
            [ 'NOTES', 'remarks' ],
            [ 'STATION_CALLSIGN', 'station_callsign' ],
            [ 'SKCC', 'skcc' ],
            [ 'NAME', 'name' ],
            [ 'STATE', 'spc' ],
            [ 'CONTEST_ID', 'contest' ],
            [ 'STX_STRING', 'stx' ],
            [ 'SRX_STRING', 'srx' ],
            [ 'CONTACTED_OP', 'contacted_op' ],
        ].forEach(([ aoName, qsoName ]) => {
            if (ao[aoName]) {
                json[qsoName] = ao[aoName];
            }
        });

        return json;
    }

    static fromAO(ao) {
        return new QSO({
            timeon: QSO.#createTimestamp(ao.QSO_DATE, ao.TIME_ON),
            timeoff: QSO.#createTimestamp(ao.QSO_DATE_OFF ? ao.QSO_DATE_OFF : ao.QSO_DATE, ao.TIME_OFF ? ao.TIME_OFF : ao.TIME_ON),
            frequency: ao.FREQ ? parseFloat(ao.FREQ) : this.#bandToFreq(ao.BAND),
            mode: ao.MODE,
            power: isNaN(parseFloat(ao.TX_PWR)) ? 0 : parseFloat(ao.TX_PWR),
            callsign: ao.CALL,
            rst_sent: isNaN(parseInt(ao.RST_SENT)) ? (ao.MODE === 'CW' ? '599' : '59') : parseInt(ao.RST_SENT),
            rst_rcvd: isNaN(parseInt(ao.RST_RCVD)) ? (ao.MODE === 'CW' ? '599' : '59') : parseInt(ao.RST_RCVD),
            remarks: ao.NOTES ?? '',
            station_callsign: ao.STATION_CALLSIGN ?? '',
            skcc: ao.SKCC ?? '',
            name: ao.NAME ?? '',
            spc: ao.STATE ?? '',
            contest: ao.CONTEST_ID ?? '',
            stx: ao.STX_STRING ?? '',
            srx: ao.SRX_STRING ?? '',
            contacted_op: ao.CONTACTED_OP ?? '',
        });
    }

    static #createTimestamp(DATE, TIME) {
        const year = DATE.slice(0, 4);
        const month = DATE.slice(4, 6);
        const day = DATE.slice(6, 8);

        TIME = TIME.length === 4 ? `${TIME}00` : TIME; /* normalize to 6 digit time */

        const hour = TIME.slice(0, 2);
        const minute = TIME.slice(2, 4);
        const second = TIME.slice(4, 6);

        return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    }

    #bandToFreq(BAND) {
        BAND = `${BAND}`.trim().toLowerCase();

        switch (BAND) {
            case '2190m': return 0.1357;
            case '630m': return 0.472;
            case '560m': return 0.501;
            case '160m': return 1.8;
            case '80m': return 3.5;
            case '60m': return 5.06;
            case '40m': return 7;
            case '30m': return 10.1;
            case '20m': return 14;
            case '17m': return 18.068;
            case '15m': return 21;
            case '12m': return 24.89;
            case '10m': return 28;
            case '8m': return 40;
            case '6m': return 50;
            case '5m': return 54.000001;
            case '4m': return 70;
            case '2m': return 144;
            case '1.25m': return 222;
            case '70cm': return 420;
            case '33cm': return 902;
            case '23cm': return 1240;
            case '13cm': return 2300;
            case '9cm': return 3300;
            case '6cm': return 5650;
            case '3cm': return 10000;
            case '1.25cm': return 24000;
            case '6mm': return 47000;
            case '4mm': return 75500;
            case '2.5mm': return 119980;
            case '2mm': return 134000;
            case '1mm': return 241000;
            case 'submm': return 300000;
            default: return 0;
        };
    }

    #freqToBand(freq) {
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

module.exports = QSO;
