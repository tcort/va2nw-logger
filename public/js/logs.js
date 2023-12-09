function setNow(suffix = 'on') {
    const now = new Date();
    const iso8601 = now.toISOString().length === 27 ? now.toISOString().slice(3) : now.toISOString();

    const date = iso8601.slice(0, 10);
    const time = iso8601.slice(11, 19);

    $(`input[name="date_${suffix}"]`).val(date).change();
    $(`input[name="time_${suffix}"]`).val(time).change();
}

function updateTimestamp() {

    if ($('input[name="now"]').is(':checked')) {
        if ($('input[name="CALL"]').val().trim() === '') {
            setNow('on');
        } else {
            setNow('off');
        }
    }

    setTimeout(() => updateTimestamp(), 444);
}

const storedFields = [
    'QSO_RANDOM',
    'STATION_CALLSIGN', 'OPERATOR', 'MY_GRIDSQUARE', 'MODE', 'FREQ', 'TX_PWR',
    'MY_NAME', 'MY_POTA_REF', 'MY_SOTA_REF', 'MY_IOTA_REF', 'MY_DXCC', 'MY_STATE', 'MY_CQ_ZONE', 'MY_ITU_ZONE',
    'MY_COUNTRY', 'MY_ARRL_SECT', 'CONTEST_ID',
    'STX', 'STX_STRING', 'APP_TCADIF_MY_KEY', 'APP_TCADIF_MY_KEY_INFO',
    'MY_ANTENNA', 'MY_RIG',
    'date_since', 'time_since',
    'date_before', 'time_before',
    'date_on', 'time_on',
    'date_off', 'time_off',
    'now',
];

function saveLocalStorage() {
    storedFields.forEach(field => {
        let val = $(`[name="${field}"]`).val();
        if (val === undefined || val === 'undefined') {
            return;
        }
        if (val === null && $(`[name="${field}"]`)?.[0]?.tagName === "SELECT") {
            val = $(`[name="${field}"]`).find(":selected").val();
        } else if ($(`[name="${field}"]`).is(':checkbox')) {
            val = $(`[name="${field}"]`).is(':checked');
        }
        window.localStorage.setItem(field, val);
    });
}

function loadLocalStorage() {
    storedFields.forEach(field => {
        if (window.localStorage.getItem(field) === 'undefined' || window.localStorage.getItem(field) === undefined) {
            return;
        }
        if ($(`[name="${field}"]`).is(':checkbox')) {
            $(`[name="${field}"]`).prop('checked', window.localStorage.getItem(field) === 'true' ?? true);
        } else {
            $(`[name="${field}"]`).val(window.localStorage.getItem(field) ?? '').change();
        }
    });

    if (!isNaN(parseInt($(`[name="STX"]`).val()))) {
        const next_serial = parseInt($(`[name="STX"]`).val()) + 1;
        $(`[name="STX"]`).val(`${next_serial}`.padStart(3, '0'));
    }
}

function defaultLocalStorage() {
    [
        [ 'SINCE_YEAR', '1901' ],
        [ 'SINCE_MONTH', '12' ],
        [ 'SINCE_DAY', '12' ],
        [ 'SINCE_HOUR', '17' ],
        [ 'SINCE_MINUTE', '30' ],
        [ 'SINCE_SECOND', '00' ],
        [ 'BEFORE_YEAR', '2099' ],
        [ 'BEFORE_MONTH', '12' ],
        [ 'BEFORE_DAY', '31' ],
        [ 'BEFORE_HOUR', '23' ],
        [ 'BEFORE_MINUTE', '59' ],
        [ 'BEFORE_SECOND', '59' ],
        [ 'QSO_RANDOM', 'Y' ],
        [ 'date_since', '1900-01-01' ],
        [ 'time_since', '00:00:00' ],
        [ 'date_before', '2099-12-31' ],
        [ 'time_before', '00:00:00' ],
    ].forEach(([ field, val ]) => {
        if (window.localStorage.getItem(field) === 'undefined') {
            window.localStorage.setItem(field, val);
        }
    });
}

$(function () {

    $(`[name="MODE"]`).on('change', function () {
        if ($(this).find(":selected").val() === 'SSB') {
            $(`[name="RST_SENT"]`).val('59');
            $(`[name="RST_RCVD"]`).val('59');
            $(`[name="APP_TCADIF_MY_KEY"]`).val('').change();
            $(`[name="APP_TCADIF_MY_KEY_INFO"]`).val('').change();
        } else {
            $(`[name="RST_SENT"]`).val('599');
            $(`[name="RST_RCVD"]`).val('599');
        }
    });

    defaultLocalStorage();

    loadLocalStorage();

    setInterval(() => saveLocalStorage(), 3000);

    tctypeahead('#callsign_search', '#callsign_search_suggestions', completer('/callsigns?startsWith=', true));
    tctypeahead('#callsign_entry', '#callsign_entry_suggestions', completer('/callsigns?startsWith=', true));
    tctypeahead('#my_rig_entry', '#my_rig_suggestions', completer('/my-rigs?startsWith='));
    tctypeahead('#my_antenna_entry', '#my_antenna_suggestions', completer('/my-antennas?startsWith='));
    tctypeahead('#app_tcadif_my_key_info_entry', '#app_tcadif_my_key_info_suggestions', completer('/app-tcadif-my-key-info?startsWith='));

    $('#skcc-roster-lookup').on('click', function () {
        const input = $('input[name="CALL"]').val().trim();
        if (input.length === 0) {
            return;
        }

        fetch('/skcc/' + encodeURIComponent(input))
            .then((response) => response.json())
            .then(member => {
                $('input[name="SKCC"]').val(member.NR);
                $('input[name="STATE"]').val(member.STATE);
                $('input[name="NAME"]').val(member.NAME);
            })
            .catch(err => console.log('error', err));
    });

    $('input.callsign').on('input', function () {
        $(this).val($(this).val().toUpperCase().trim());
    });

    $('#callsign_entry').on('input', function () {

        $('#recent_qsos').html('');

        const input = $(this).val().trim();
        if (input.length === 0) {
            return;
        }

        fetch('/logs?limit=3&fmt=json&since=1900-01-01T00:00:00Z&order=desc&callsign=' + encodeURIComponent(input))
            .then((response) => response.json())
            .then(logs => {
                if (logs.length === 0) {
                    return;
                }
                const html = 'Recent QSOs: ' + logs.map((log, index) => `${log.TIMESTAMP.split('T')[0]} (${log.BAND})`).join(', ');
                $('#recent_qsos').html(html);
            })
            .catch(err => console.log('error', err));

    });

    [ 'on', 'off' ].forEach(suffix => {
        $(`button[id="time${suffix}_now"]`).on('click', function () {
            setNow(suffix);
        });
    });

    [ 'date', 'time' ].forEach(field => {
        $(`input[name="${field}_on"]`).on('change', function () {
            $(`input[name="${field}_off"]`).val(
                $(`input[name="${field}_on"]`).val()
            ).change();
        });
    });

    updateTimestamp();
});


