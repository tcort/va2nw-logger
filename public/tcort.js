$(function () {
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

    $('.navtab').first().click();

    $(".clickable-row").click(function() {
        window.location = $(this).data("href");
    });

    $('input').on('input', function () {
        const maxLength = parseInt($(this).attr('maxlength'));
        if (isNaN(maxLength)) {
            return;
        } else if ($(this).val().length === maxLength) {
            const form = $(this).closest("form");
            const inputs = $(form).find('input, textarea');
            const thisInputIndex = $(inputs).index(this);
            if (thisInputIndex + 1 < inputs.length) {
                $(inputs[thisInputIndex + 1]).focus().select();
            }
        }
    });
});

function encodeHtmlEntities(str) {
    return $('<div>').text(`${str}`).html();
}

function tctypeahead(input, datalist, fn) {

    $(input).on('input', function (evt) {

        const input = $(this).val();

        fn(input, function (err, choices) {
            if (err) {
                console.log('error', err);
                return;
            }

            if (!Array.isArray(choices) && typeof choices === 'object' && choices !== null) {
                choices = Object.entries(choices);
            }

            if (!Array.isArray(choices)) {
                return;
            }

            const html = choices.map((choice, index) => {
                if (Array.isArray(choice)) {
                    return `<option value="${encodeHtmlEntities(choice[1])}">${encodeHtmlEntities(choice[0])}</option>`;
                } else {
                    return `<option>${encodeHtmlEntities(choice)}</option>`;
                }
            }).join('\n');

            $(datalist).html(html);
        });
    });

}