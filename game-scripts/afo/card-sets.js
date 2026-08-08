if (typeof GAME !== 'undefined') {
var KARTY = {
    _cache: null,        // zestawy kart załadowane dla aktualnej postaci
    _loadedFor: null,    // char_id, dla którego trzymamy _cache
};
KARTY.storageKey = () => 'swa_card_sets_' + GAME.char_id;

Object.defineProperty(KARTY, 'sets', {
    get: () => {
        if (KARTY._loadedFor !== GAME.char_id) {
            try { KARTY._cache = JSON.parse(localStorage.getItem(KARTY.storageKey())) || [null, null, null, null, null]; }
            catch (e) { KARTY._cache = [null, null, null, null, null]; }
            KARTY._loadedFor = GAME.char_id;
        }
        return KARTY._cache;
    }
});
KARTY.persist = () => {
    try { localStorage.setItem(KARTY.storageKey(), JSON.stringify(KARTY.sets)); } catch (e) { return; }
};
KARTY.parseCardId = (src) => {
    var m = /\/cards\/(\d+)\.png/.exec(src || '');
    return m ? parseInt(m[1]) : null;
};
KARTY.readActiveCards = () => {
    var active = [];
    $('.card_slot').each(function() {
        var card = $(this).find('.small_card').first();
        if (!card.length) return;
        var cardId = KARTY.parseCardId(card.find('img').attr('src'));
        var level = parseInt(card.find('span').first().text());
        if (cardId) active.push({ card_id: cardId, level: level });
    });
    return active;
};
KARTY.readPool = () => {
    var pool = [];
    $('.card_option').each(function() {
        var cardId = KARTY.parseCardId($(this).find('img').attr('src'));
        var level = parseInt($(this).find('span').first().text());
        var iid = parseInt($(this).attr('data-card_id'));
        if (cardId && iid) pool.push({ card_id: cardId, level: level, iid: iid });
    });
    return pool;
};
KARTY.defaultName = (idx) => 'Karty ' + (idx + 1);
KARTY.getName = (idx) => (KARTY.sets[idx] && KARTY.sets[idx].name) || KARTY.defaultName(idx);
KARTY.rename = (idx, name) => {
    name = (name || '').trim() || KARTY.defaultName(idx);
    if (!KARTY.sets[idx]) KARTY.sets[idx] = { name: name, cards: [] };
    else KARTY.sets[idx].name = name;
    KARTY.persist();
};
KARTY.save = (idx) => {
    var active = KARTY.readActiveCards();
    var name = ($('#karty_Panel .eqs_name[data-idx="' + idx + '"]').val() || '').trim() || KARTY.getName(idx);
    console.log('[KARTY] save', idx, JSON.stringify(active));
    KARTY.sets[idx] = { name: name, cards: active };
    KARTY.persist();
    GAME.komunikat('Zapisano zestaw kart "' + name + '" (' + active.length + ' kart).');
};
KARTY.equip = (idx) => {
    var set = KARTY.sets[idx];
    var wanted = set ? set.cards : [];
    console.log('[KARTY] equip', idx, JSON.stringify(wanted));
    if (!wanted || !wanted.length) {
        GAME.komunikat('Zestaw kart "' + KARTY.getName(idx) + '" jest pusty.');
        return;
    }
    var occupiedSlots = [];
    $('.card_slot').each(function() {
        if ($(this).find('.small_card').length) occupiedSlots.push(parseInt($(this).attr('data-slot')));
    });
    var equipStep = (j) => {
        if (j >= wanted.length) return;
        var want = wanted[j];
        var pool = KARTY.readPool();
        var match = pool.find((p) => p.card_id === want.card_id && p.level === want.level);
        if (match) {
            console.log('[KARTY] use_card', match.iid, 'for', want);
            GAME.emitOrder({ a: 58, type: 1, card: match.iid });
        } else {
            console.log('[KARTY] brak karty w puli dla', want);
        }
        setTimeout(() => equipStep(j + 1), 500);
    };
    var i = 0;
    var clearStep = () => {
        if (i >= occupiedSlots.length) {
            setTimeout(() => equipStep(0), 500);
            return;
        }
        console.log('[KARTY] clear_sslot', occupiedSlots[i]);
        GAME.emitOrder({ a: 58, type: 2, slot: occupiedSlots[i] });
        i++;
        setTimeout(clearStep, 400);
    };
    if (occupiedSlots.length) clearStep();
    else equipStep(0);
};
$('#karty_Panel .eqs_name').each(function() {
    var idx = parseInt($(this).data('idx'));
    $(this).val(KARTY.getName(idx));
});
$('#karty_Panel .eqs_name').change((e) => {
    var idx = parseInt($(e.currentTarget).data('idx'));
    KARTY.rename(idx, $(e.currentTarget).val());
    $(e.currentTarget).val(KARTY.getName(idx));
});
}
