'use strict';

const moment = require('moment');

function sortByKey(a, b) {
    const [ ka, va ] = a;
    const [ kb, vb ] = b;
    if (ka < kb) { return -1; }
    else if (ka > kb) { return 1; }
    else { return 0; }
}

class Stats {

    static compute(logs) {

        const callsigns = new Set();
        const modes = new Map();
        const bands = new Map();
        const years = new Map();
        const months = new Map();
        const daysofweek = new Map();

        logs.forEach(log => {
            callsigns.add(log.CALL);
            modes.set(log.MODE, (modes.get(log.MODE) ?? 0) + 1);
            bands.set(log.BAND, (bands.get(log.BAND) ?? 0) + 1);

            const year = moment(log.TIMESTAMP).format('YYYY');
            years.set(year, (years.get(year) ?? 0) + 1);

            const month = moment(log.TIMESTAMP).format('MM');
            months.set(month, (months.get(month) ?? 0) + 1);

            const dayofweek = moment(log.TIMESTAMP).format('E');
            daysofweek.set(dayofweek, (daysofweek.get(dayofweek) ?? 0) + 1);
        });

        return {
            nqso: logs.length,
            ncallsigns: callsigns.size,
            modes: [...modes].sort(sortByKey),
            bands: [...bands].sort(sortByKey),
            years: [...years].sort(sortByKey),
            months: [...months].sort(sortByKey).map(([ month, count ]) => [ moment(month, 'MM').format('MMMM'), count ]),
            daysofweek: [...daysofweek].sort(sortByKey).map(([ dayofweek, count ]) => [ moment(dayofweek, 'E').format('dddd'), count ]),
        };

    }

}

module.exports = Stats;
