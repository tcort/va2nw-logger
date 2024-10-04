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
        if ($('input[name="callsign"]').val().trim() === '' || $('input[name="callsign"]').is(':focus')) {
            setNow('on');
        } else {
            setNow('off');
        }
    }

    setTimeout(() => updateTimestamp(), 444);
}

const storedFields = [
    'mode', 'frequency', 'power',
    'date_since', 'time_since',
    'date_before', 'time_before',
    'date_on', 'time_on',
    'date_off', 'time_off',
    'now', 'station_callsign',
];

function defaultLocalStorage() {
    [
        [ 'date_since', '1900-01-01' ],
        [ 'time_since', '00:00:00' ],
        [ 'date_before', '2099-12-31' ],
        [ 'time_before', '00:00:00' ],
    ].forEach(([ field, val ]) => {
        if (window.localStorage.getItem(field) === undefined || window.localStorage.getItem(field) === 'undefined') {
            window.localStorage.setItem(field, val);
        }
    });

    if (window.localStorage.getItem('now') === undefined || window.localStorage.getItem('now') === 'undefined') {
        window.localStorage.setItem('now','true');
    }
}

function saveLocalStorage() {
    storedFields.forEach(field => {
        let val = $(`.autosave [name="${field}"]:not(.nosave)`).val();
        if (val === null && $(`.autosave [name="${field}"]:not(.nosave)`)?.[0]?.tagName === "SELECT") {
            val = $(`.autosave [name="${field}"]:not(.nosave)`).find(":selected").val();
        } else if ($(`.autosave [name="${field}"]:not(.nosave)`).is(':checkbox')) {
            val = $(`.autosave [name="${field}"]:not(.nosave)`).is(':checked');
        }
        if (val !== undefined) {
            window.localStorage.setItem(field, val);
        }
    });
}

function loadLocalStorage() {
    storedFields.forEach(field => {
        if ($(`.autosave [name="${field}"]:not(.nosave)`).is(':checkbox')) {
            $(`.autosave [name="${field}"]:not(.nosave)`).prop('checked', window.localStorage.getItem(field) === 'true' ?? true);
        } else {
            $(`.autosave [name="${field}"]:not(.nosave)`).val(window.localStorage.getItem(field) ?? '').change();
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

    defaultLocalStorage();

    loadLocalStorage();

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

    $('.callsign_entry').on('blur', function () {
        $(this).val($(this).val().toUpperCase().trim());
    });

    if ($('.autosave').length > 0) {
        setInterval(() => saveLocalStorage(), 3000);
    }

    updateTimestamp();

    $('#callsign').on('input', function () {
        $(this).val($(this).val().trim().toUpperCase());
    });


    $('#callsign').on('input', function () {

        $('#recent_qsos').html('');
        const input = $(this).val().trim();
        if (input.length === 0) {
            return;
        }

        fetch('/qsos?page=0&pageSize=5&fmt=json&since=1900-01-01T00:00:00Z&order=desc&callsign=' + encodeURIComponent(input))
            .then((response) => response.json())
            .then(qsos => {
                if (qsos.length === 0) {
                    return;
                }
                const html = qsos.map(qso => `${qso.timeon.split('T')[0]} (${qso.frequency.toString().split('.')[0]} MHz)`).join(', ');
                $('#recent_qsos').html(html);
            })
            .catch(err => console.log('error', err));

    });

});



$(document).ready(function() {
    $(".navbar-burger").click(function() {
        $(".navbar-burger").toggleClass("is-active");
        $(".navbar-menu").toggleClass("is-active");
    });
});
