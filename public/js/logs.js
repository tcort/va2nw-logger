function updateTimestamp() {

    if ($('input[name="NOW"]').is(':checked')) {

        const now = new Date();
        const iso8601 = now.toISOString().length === 27 ? now.toISOString().slice(3) : now.toISOString();

        const year = iso8601.slice(0, 4);
        const month = iso8601.slice(5, 7);
        const day = iso8601.slice(8, 10);
        const hour = iso8601.slice(11, 13);
        const minute = iso8601.slice(14, 16);
        const second = iso8601.slice(17, 19);

        $('select[name="YEAR"]').val(year).change();
        $('select[name="MONTH"]').val(month).change();
        $('select[name="DAY"]').val(day).change();
        $('select[name="HOUR"]').val(hour).change();
        $('select[name="MINUTE"]').val(minute).change();
        $('select[name="SECOND"]').val(second).change();

    }

    setTimeout(() => updateTimestamp(), 1000);
}

const storedFields = [
    'STATION_CALLSIGN', 'OPERATOR', 'MY_GRIDSQUARE', 'MODE', 'FREQ', 'TX_PWR',
    'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'NOW', 'MY_RIG', 'MY_ANTENNA',
    'MY_NAME', 'MY_POTA_REF', 'MY_DXCC', 'MY_STATE', 'MY_CQ_ZONE', 'MY_ITU_ZONE',
    'MY_COUNTRY', 'MY_ARRL_SECT',
];

function saveLocalStorage() {
    storedFields.forEach(field => {
        let val = $(`[name="${field}"]`).val();
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
        if ($(`[name="${field}"]`).is(':checkbox')) {
            $(`[name="${field}"]`).prop('checked', window.localStorage.getItem(field) === 'true' ?? true);
        } else {
            $(`[name="${field}"]`).val(window.localStorage.getItem(field) ?? '').change();
        }
    });

}

$(function () {

    $(`[name="MODE"]`).on('change', function () {
        if ($(this).find(":selected").val() === 'SSB') {
            $(`[name="RST_SENT"]`).val('59');
            $(`[name="RST_RCVD"]`).val('59');
        } else {
            $(`[name="RST_SENT"]`).val('599');
            $(`[name="RST_RCVD"]`).val('599');
        }
    });

    loadLocalStorage();

    setInterval(() => saveLocalStorage(), 4000);

    updateTimestamp();

    function completer(baseUrl, toUpper = false) {
        return function (input, callback) {
            const startsWith = toUpper ? `${input}`.toUpperCase() : `${input}`;
            fetch(baseUrl + encodeURIComponent(startsWith))
                .then((response) => response.json())
                .then(callsigns =>  callback(null, callsigns) )
                .catch(err => callback(err));
        };
    }


    tctypeahead('#callsign_search', '#callsign_search_suggestions', completer('/callsigns?startsWith=', true));
    tctypeahead('#callsign_entry', '#callsign_entry_suggestions', completer('/callsigns?startsWith=', true));
    tctypeahead('#my_rig_entry', '#my_rig_suggestions', completer('/my-rigs?startsWith='));
    tctypeahead('#my_antenna_entry', '#my_antenna_suggestions', completer('/my-antennas?startsWith='));

    $('.toggle-visibility').on('click', function () {
        const target = $(this).data('target');
        $(`#${target}`).toggleClass('hidden');

        $(this).text( $(this).text() === '-' ? '+' : '-' );
    });

    $('.navtab').on('click', function () {
        $('.navtab').each(function () {
            $(this).removeClass('activetab');
        });
        $('.navtarget').each(function () {
            $(this).addClass('hidden');
        });
        $($(this).data('target')).removeClass('hidden');
        $(this).addClass('activetab');
    });

    $('#show-logs').click();
});


