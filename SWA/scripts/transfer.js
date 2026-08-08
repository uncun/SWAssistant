(function () {
if (window.__SWA_TRANSFER_ENGINE_RUNNING__) return;
window.__SWA_TRANSFER_ENGINE_RUNNING__ = true;

var TICK = 30;           // ms - odstęp między rundami skanowania ekwipunku
var CLICK_WAIT = 30;     // ms - odstęp po emitOrder, zanim klikniemy potwierdzenie

var transferStopped = false;
var transferTimeout = null;

function getNick () {
    return (localStorage.getItem('swa_transfer_nick') || '').trim();
}
function getItemClass () {
    var v = parseInt(localStorage.getItem('swa_transfer_class'), 10);
    return isNaN(v) ? 4 : v;
}

function cycle () {
    if (transferStopped) return;

    var nick = getNick();
    if (!nick) {
        transferTimeout = window.setTimeout(cycle, TICK);
        return;
    }

    $('#kom_con').remove();

    var items = [];
    $('#ekw_page_items .nonstackable[data-class="' + getItemClass() + '"]').each(function () {
        items.push(parseInt($(this).data('item_id'), 10));
    });

    if (items.length) {
        $('#trade_nick').value = nick;
        GAME.emitOrder({ a: 12, type: 20, iid: items, page: GAME.ekw_page, nick: nick });

        transferTimeout = window.setTimeout(function () {
            $('[data-option="tra2_item"]').click();
            transferTimeout = window.setTimeout(cycle, TICK);
        }, CLICK_WAIT);
    } else {
        transferTimeout = window.setTimeout(cycle, TICK);
    }
}

window.__SWA_TRANSFER_STOP__ = function () {
    transferStopped = true;
    if (transferTimeout) window.clearTimeout(transferTimeout);
    transferTimeout = null;
    window.__SWA_TRANSFER_ENGINE_RUNNING__ = false;
};

cycle();
})();
