function setNow(suffix = 'on') {
    const now = new Date();
    const iso8601 = now.toISOString().length === 27 ? now.toISOString().slice(3) : now.toISOString();

    const year = iso8601.slice(0, 4);
    const month = iso8601.slice(5, 7);
    const day = iso8601.slice(8, 10);
    const hour = iso8601.slice(11, 13);
    const minute = iso8601.slice(14, 16);
    const second = iso8601.slice(17, 19);

    $(`input[name="year_${suffix}"]`).val(year).change();
    $(`select[name="month_${suffix}"]`).val(month).change();
    $(`input[name="day_${suffix}"]`).val(day).change();
    $(`input[name="hour_${suffix}"]`).val(hour).change();
    $(`input[name="minute_${suffix}"]`).val(minute).change();
    $(`input[name="second_${suffix}"]`).val(second).change();

}

function updateTimestamp() {

    if ($('input[name="now"]').is(':checked')) {

        const now = new Date();
        const iso8601 = now.toISOString().length === 27 ? now.toISOString().slice(3) : now.toISOString();

        const year = iso8601.slice(0, 4);
        const month = iso8601.slice(5, 7);
        const day = iso8601.slice(8, 10);
        const hour = iso8601.slice(11, 13);
        const minute = iso8601.slice(14, 16);
        const second = iso8601.slice(17, 19);

        if ($('input[name="callsign"]').val().trim() === '') {
            setNow('on');
        } else {
            setNow('off');
        }
    }

    setTimeout(() => updateTimestamp(), 444);
}

const storedFields = [
    'mode', 'frequency', 'power',
    'year_since', 'month_since', 'day_since', 'hour_since', 'minute_since', 'second_since',
    'year_after', 'month_after', 'day_after', 'hour_after', 'minute_after', 'second_after',
    'year_on', 'month_on', 'day_on', 'hour_on', 'minute_on', 'second_on',
    'year_off', 'month_off', 'day_off', 'hour_off', 'minute_off', 'second_off',
    'now',
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

    $(`[name="mode"]`).on('change', function () {
        if ($(this).find(":selected").val() === 'CW') {
            $(`[name="rst_sent"]`).val('599');
            $(`[name="rst_rcvd"]`).val('599');
        } else {
            $(`[name="rst_sent"]`).val('59');
            $(`[name="rst_rcvd"]`).val('59');
        }
    });

    loadLocalStorage();

    [ 'on', 'off' ].forEach(suffix => {
        $(`button[id="time${suffix}_now"]`).on('click', function () {
            setNow(suffix);
        });
    });

    [ 'year', 'day', 'hour', 'minute', 'second' ].forEach(field => {
        $(`input[name="${field}_on"]`).on('change', function () {
            $(`input[name="${field}_off"]`).val(
                $(`input[name="${field}_on"]`).val()
            ).change();
        });
    });

    $('.callsign_entry').on('input', function () {
        $(this).val($(this).val().toUpperCase().trim());
    });

    $(`select[name="month_on"]`).on('change', function () {
        $(`select[name="month_off"]`).val(
            $(`select[name="month_on"]`).find(':selected').val()
        ).change();
    });

    setInterval(() => saveLocalStorage(), 3000);

    updateTimestamp();

});
