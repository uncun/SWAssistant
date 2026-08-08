var Assistant = window.Assistant;

// Ukrywa okno walki dla ataków bez błyskawicznej walki (multi).
// GAME.parseFight() buduje i animuje okno walki (fadeIn) - w oknie czasu tuż po
// naszym ataku po prostu go nie pokazujemy. Wynik walki i tak przetwarza
// osobno parseFightResult, więc niczego nie tracimy.
Assistant.prototype.hideFightWindow = function (seconds) {
    if (!GAME.__swa_fightPatched) {
        GAME.__swa_fightPatched = true;
        let _origParseFight = GAME.parseFight;
        GAME.parseFight = function () {
            if (GAME.__swa_suppress_fight_until && GAME.getTime() < GAME.__swa_suppress_fight_until) {
                clearInterval(this.fight_timer);
                $('#fight_view').hide();
                return;
            }
            return _origParseFight.apply(this, arguments);
        };
    }
    GAME.__swa_suppress_fight_until = GAME.getTime() + (seconds || 3);
};

Assistant.prototype.wojny2 = function () {
    var aimp = $("#e_admiral_player").find("[data-option=show_player]").attr("data-char_id");
    var imp = $("#leader_player").find("[data-option=show_player]").attr("data-char_id");
    if (!adimp) {
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 50,
                type: 0,
                empire: GAME.char_data.empire
            });
        }, 100);
        adimp = true;
        setTimeout(() => {
            this.wojny2();
        }, 300);
    } else if (!GAME.emp_enemies.includes(1) && ![GAME.char_data.empire].includes(1) && (assistant.check_imp().includes(GAME.char_id) || assistant.check_imp2().includes(GAME.char_id) || imp == GAME.char_id || aimp == GAME.char_id)) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 7,
            target: 1
        });
        setTimeout(() => {
            this.wojny2();
        }, 300);
    } else if (!GAME.emp_enemies.includes(2) && ![GAME.char_data.empire].includes(2) && (assistant.check_imp().includes(GAME.char_id) || assistant.check_imp2().includes(GAME.char_id) || imp == GAME.char_id || aimp == GAME.char_id)) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 7,
            target: 2
        });
        setTimeout(() => {
            this.wojny2();
        }, 300);
    } else if (!GAME.emp_enemies.includes(3) && ![GAME.char_data.empire].includes(3) && (assistant.check_imp().includes(GAME.char_id) || assistant.check_imp2().includes(GAME.char_id) || imp == GAME.char_id || aimp == GAME.char_id)) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 7,
            target: 3
        });
        setTimeout(() => {
            this.wojny2();
        }, 300);
    } else if (!GAME.emp_enemies.includes(4) && ![GAME.char_data.empire].includes(4) && (assistant.check_imp().includes(GAME.char_id) || assistant.check_imp2().includes(GAME.char_id) || imp == GAME.char_id || aimp == GAME.char_id)) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 7,
            target: 4
        });
        setTimeout(() => {
            this.wojny2();
        }, 300);
    }
};

Assistant.prototype.check_imp = function () {
    var tab = [];
    for (var i = 0; i < 3; i++) {
        tab[i] = parseInt($("#empire_heroes .activity").eq(i).find("[data-option=show_player]").attr("data-char_id"));
    }
    return tab;
};

Assistant.prototype.check_imp2 = function () {
    var tab = [];
    for (var i = 0; i < 3; i++) {
        tab[i] = parseInt($("#empire_efrags .activity").eq(i).find("[data-option=show_player]").attr("data-char_id"));
    }
    return tab;
};

Assistant.prototype.pvpKill = function (attacked) {
    if (JQS.chm.is(":focus")) return;
    attacked = attacked || {};
    if ($("button[data-option='load_more_players']").is(":visible")) {
        $("button[data-option='load_more_players']").click();
        setTimeout(() => {
            this.pvpKill(attacked);
        }, 11);
        return;
    }
    // jeden przycisk na przeciwnika - preferuj błyskawiczną walkę, gdy dostępna,
    // ale atakuj też normalnie (bez błyskawicznej) gdy przycisku quick nie ma
    let seen = {}, els = [];
    $("#player_list_con").find(".player")
        .find("button[data-option=pvp_attack], button[data-option=gpvp_attack]")
        .filter(":not(.initial_hide_forced)")
        .each(function () {
            let id = $(this).attr("data-char_id");
            if (!id || attacked[id]) return;
            let isQuick = $(this).attr("data-quick") == "1";
            if (!(id in seen)) { seen[id] = els.length; els.push(this); }
            else if (isQuick) { els[seen[id]] = this; }
        });
    if (els.length > 0) {
        let $btn = $(els[0]);
        attacked[$btn.attr("data-char_id")] = true;
        // normalna walka (bez błyskawicznej) otwiera okno walki - nie pokazujemy go
        if ($btn.attr("data-quick") != "1") this.hideFightWindow();
        $btn.click();
        setTimeout(() => {
            this.pvpKill(attacked);
        }, 11);
    }
};

Assistant.prototype.useCompressor = function () {
    GAME.emitOrder({
        a: 22,
        type: 10,
        qb_id: jQuery('#quest_con').find(`[data-option='compress_items']`).data('qb_id')
      });
};

Assistant.prototype.killChamp = function () {
    var mob_id;
    var mob_size;
    for (var i = 0; i < GAME.field_mobs.length; i++) {
        if (GAME.field_mobs[i].custom_rank == 1) {
            mob_id = i;
            mob_size = GAME.field_mobs[i].ranks[GAME.field_mobs[i].custom_rank];
        }
    }
    if (mob_size > 0) {
        GAME.emitOrder({a:7,mob_num:mob_id,rank:1});
        setTimeout(() => {
            $('#fight_view').fadeOut();
        }, 200);
    }
};

Assistant.prototype.killElite = function () {
    var mob_id;
    var mob_size;
    for (var i = 0; i < GAME.field_mobs.length; i++) {
        console.log("searching elite");
        if (GAME.field_mobs[i].custom_rank == 2) {
            mob_id = i;
            mob_size = GAME.field_mobs[i].ranks[GAME.field_mobs[i].custom_rank];
            console.log("elite", mob_id, mob_size);
        }
    }
    if (mob_size > 0) {
        GAME.emitOrder({a:7,mob_num:mob_id,rank:2});
        setTimeout(() => {
            $('#fight_view').fadeOut();
        }, 200);
    }
    
};

Assistant.prototype.killBoss = function () {
    var mob_id;
    var mob_size;
    for (var i = 0; i < GAME.field_mobs.length; i++) {
        if (GAME.field_mobs[i].custom_rank == 3) {
            mob_id = i;
            mob_size = GAME.field_mobs[i].ranks[GAME.field_mobs[i].custom_rank];
        }
    }
    if (mob_size > 0) {
        GAME.emitOrder({a:7,mob_num:mob_id,rank:3});
        setTimeout(() => {
            $('#fight_view').fadeOut();
        }, 200);
    }
};

