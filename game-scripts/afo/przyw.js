if (typeof GAME !== 'undefined') {
var PRZYW = {
    stop: true,
    busy: false,
    kill: true,              // true = zabijaj zrespione moby, false = tylko przywołuj
    group: false,            // true = atak grupowy, false = atak pojedynczy
    rank: 'champion',        // champion | elite | boss
    amount: 1,               // ile przywoływaczy użyć na raz
    wait: 50,                // ms - odstęp między akcjami pętli (bicie)
    spawnWait: 700,          // ms - czas na pojawienie się mobów po przywołaniu
    ekwWait: 500,            // ms - czas na załadowanie itemków usable po a:12,type:7
    used: 0,                 // ile przywoływaczy użyto
    killed: 0,               // ile mobków zabito
    // statyczna identyfikacja przywoływaczy po obrazku (iid zmienia się przy nowym stacku)
    SUMMONERS: {
        champion: { img: 'cons/35.png', customRank: 1, label: 'Champion' },
        elite:    { img: 'cons/36.png', customRank: 2, label: 'Elita' },
        boss:     { img: 'cons/37.png', customRank: 3, label: 'Boss' }
    }
};

PRZYW.conf = function () {
    return PRZYW.SUMMONERS[PRZYW.rank] || PRZYW.SUMMONERS.champion;
};

PRZYW.reloadMap = function () {
    GAME.loadMapJson(function () {
        GAME.socket.emit('ga', { a: 3, vo: GAME.map_options.vo }, 1);
    });
};

PRZYW.findSpawnedMob = function (customRank) {
    if (!GAME.field_mobs) return null;
    for (var i = 0; i < GAME.field_mobs.length; i++) {
        var m = GAME.field_mobs[i];
        if (m && m.custom_rank == customRank && m.ranks && m.ranks[customRank] > 0) {
            return { id: i, rank: customRank };
        }
    }
    return null;
};

PRZYW.killMob = function (mob) {
    // surowy socket.emit - dokładnie jak robi to gra (a:205 grupowy nie przechodził przez emitOrder)
    var a = PRZYW.group ? 205 : 7;
    GAME.socket.emit('ga', { a: a, mob_num: mob.id, rank: mob.rank });
    setTimeout(function () {
        $('#fight_view').fadeOut();
    }, 200);
};

PRZYW.useSummoner = function (amt, cb) {
    var conf = PRZYW.conf();
    var imgRe = new RegExp(conf.img.replace('.', '\\.'));
    GAME.emitOrder({ a: 12, type: 7 });
    setTimeout(function () {
        var $item = $('#ekw_page_items [data-option="use_usable"]').filter(function () {
            return imgRe.test($(this).find('img').attr('src') || '');
        }).first();
        var iid = parseInt($item.data('iid'));
        if (iid) {
            GAME.emitOrder({ a: 12, type: 8, iid: iid, amount: amt, sel: 0 });
            PRZYW.reloadMap();
            cb(true, amt);
        } else {
            GAME.komunikat('Brak przywoływacza (' + conf.label + ') w ekwipunku - zatrzymuję.');
            cb(false, 0);
        }
    }, PRZYW.ekwWait);
};

PRZYW.updateCounter = function () {
    $('#przyw_Panel .przyw_counter').text('Przywołano: ' + PRZYW.used + ' | Zabito: ' + PRZYW.killed);
};

PRZYW.tick = function () {
    if (PRZYW.stop) return;
    var conf = PRZYW.conf();
    var mob = PRZYW.findSpawnedMob(conf.customRank);
    if (mob) {
        PRZYW.killMob(mob);
        PRZYW.killed++;
        PRZYW.updateCounter();
        setTimeout(PRZYW.tick, PRZYW.wait);
        return;
    }
    GAME.komunikat('Zabito przywołane moby (' + PRZYW.killed + ') - gotowe.');
    PRZYW.doStop();
};

PRZYW.start = function () {
    if (!PRZYW.stop) return;
    PRZYW.stop = false;
    PRZYW.busy = true;
    $('.przyw_start .przyw_status').removeClass('red').addClass('green').html('On');
    if (PRZYW.amount <= 0) {
        PRZYW.busy = false;
        PRZYW.tick();
        return;
    }
    PRZYW.useSummoner(PRZYW.amount, function (ok, usedAmt) {
        PRZYW.busy = false;
        if (PRZYW.stop) return;
        if (!ok) {
            PRZYW.doStop();
            return;
        }
        PRZYW.used += usedAmt;
        PRZYW.updateCounter();
        if (!PRZYW.kill) {
            GAME.komunikat('Przywołano ' + usedAmt + ' - moby zostawione.');
            PRZYW.doStop();
            return;
        }
        setTimeout(PRZYW.tick, PRZYW.spawnWait);
    });
};

PRZYW.doStop = function () {
    PRZYW.stop = true;
    PRZYW.busy = false;
    $('.przyw_start .przyw_status').removeClass('green').addClass('red').html('Off');
};

PRZYW.initPanel = function () {
    PRZYW.kill = localStorage.getItem('swa_przyw_kill') !== '0';
    var $killStatus = $('#przyw_Panel .przyw_kill .przyw_status');
    if (PRZYW.kill) $killStatus.removeClass('red').addClass('green').html('On');
    else $killStatus.removeClass('green').addClass('red').html('Off');
    $('#przyw_Panel .przyw_kill').click(function () {
        PRZYW.kill = !PRZYW.kill;
        if (PRZYW.kill) $killStatus.removeClass('red').addClass('green').html('On');
        else $killStatus.removeClass('green').addClass('red').html('Off');
        localStorage.setItem('swa_przyw_kill', PRZYW.kill ? '1' : '0');
    });

    PRZYW.group = localStorage.getItem('swa_przyw_group') === '1';
    var $grpStatus = $('#przyw_Panel .przyw_group .przyw_status');
    if (PRZYW.group) $grpStatus.removeClass('red').addClass('green').html('On');
    else $grpStatus.removeClass('green').addClass('red').html('Off');
    $('#przyw_Panel .przyw_group').click(function () {
        PRZYW.group = !PRZYW.group;
        if (PRZYW.group) $grpStatus.removeClass('red').addClass('green').html('On');
        else $grpStatus.removeClass('green').addClass('red').html('Off');
        localStorage.setItem('swa_przyw_group', PRZYW.group ? '1' : '0');
    });

    var savedRank = localStorage.getItem('swa_przyw_rank');
    if (savedRank && PRZYW.SUMMONERS[savedRank]) PRZYW.rank = savedRank;
    $('#przyw_Panel select[name=przyw_rank]').val(PRZYW.rank);
    $('#przyw_Panel select[name=przyw_rank]').change(function (e) {
        PRZYW.rank = $(e.target).val();
        localStorage.setItem('swa_przyw_rank', PRZYW.rank);
    });

    var storedAmount = parseInt(localStorage.getItem('swa_przyw_amount'));
    PRZYW.amount = isNaN(storedAmount) ? 1 : storedAmount;
    $('#przyw_Panel input[name=przyw_amount]').val(PRZYW.amount);
    $('#przyw_Panel input[name=przyw_amount]').change(function (e) {
        var v = parseInt($(e.target).val());
        PRZYW.amount = (v >= 0) ? v : 1;
        $(e.target).val(PRZYW.amount);
        localStorage.setItem('swa_przyw_amount', PRZYW.amount);
    });

    PRZYW.wait = parseInt(localStorage.getItem('swa_przyw_wait')) || 50;
    $('#przyw_Panel input[name=przyw_wait]').val(PRZYW.wait);
    $('#przyw_Panel input[name=przyw_wait]').change(function (e) {
        var v = parseInt($(e.target).val());
        PRZYW.wait = (v >= 10) ? v : 50;
        $(e.target).val(PRZYW.wait);
        localStorage.setItem('swa_przyw_wait', PRZYW.wait);
    });

    $('#przyw_Panel .przyw_start').click(function () {
        if (PRZYW.stop) {
            PRZYW.used = 0;
            PRZYW.killed = 0;
            PRZYW.updateCounter();
            PRZYW.start();
        } else {
            PRZYW.doStop();
        }
    });

    PRZYW.updateCounter();
};
}
