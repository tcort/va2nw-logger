'use strict';

const moment = require('moment');

class Cabrillo {

    static toQSO(log) {

        const freq = `${Math.round(log.FREQ * 1000)}`.padStart(5,' ');
        const mode = log.MODE === 'CW' ? 'CW' : 'PH';
        const date = moment(log.QSO_DATE, 'YYYYMMDD').format('YYYY-MM-DD');
        const time = moment(log.TIME_ON, 'HHmmss').format('HHmm');
        const sent_call = log.STATION_CALLSIGN.padEnd(13, ' ');;
        const sent_rst = log.RST_SENT.padEnd(3, ' ');
        const sent_exch = `${log.STX ?? ''}`.padEnd(6, ' ');
        const rcvd_call = log.CALL.padEnd(13, ' ');
        const rcvd_rst = log.RST_RCVD.padEnd(3, ' ');;
        const rcvd_exch = `${log.SRX ?? ''}`.padEnd(6, ' ');

        return `QSO: ${freq} ${mode} ${date} ${time} ${sent_call} ${sent_rst} ${sent_exch} ${rcvd_call} ${rcvd_rst} ${rcvd_exch}`;
    }

}

module.exports = Cabrillo;
