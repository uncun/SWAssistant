var Assistant = window.Assistant;
Assistant.prototype.manageAutoAbyss = function () {
    GAME.socket.emit('ga', {
        a: 59,
        type: 0
    });

    if ($("#ss_cd_still").css("display") == "none") {
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 59,
                type: 1
            });
        }, 100);
        setTimeout(() => {
            $('#fight_view').fadeOut();
        }, 200);
        setTimeout(() => {
            if ((GAME.char_data.reborn == 4 || GAME.char_data.reborn == 5) && GAME.char_data.alt_transform_expiry < GAME.getTime()) {
                GAME.socket.emit('ga', {
                    a: 18,
                    type: 8,
                    tech_id: 134
                });
            }
        }, 300);
    }
};

Assistant.prototype.manageAutoArena = function () {
    if (this.auto_arena) {
        this.arena_loaded_for_char = GAME.char_id;
        GAME.socket.emit('ga', {
            a: 46,
            type: 0
        });
        setTimeout(() => {
            this.attackAutoArena();
        }, 100);
    } else {
        this.stopAutoArena();
    }
};

Assistant.prototype.attackAutoArena = function () {
    if (GAME.char_id !== this.arena_loaded_for_char) {
        setTimeout(() => {
            this.manageAutoArena();
        }, 1000);
        return;
    }
    // jeden przycisk na przeciwnika - preferuj błyskawiczną walkę, gdy dostępna,
    // ale atakuj też normalnie (bez błyskawicznej) gdy przycisku quick nie ma
    let seen = {}, btns = [];
    $("#arena_players").find(`.player button[data-option="arena_attack"]:not(.initial_hide_forced)`).each(function () {
        let idx = $(this).attr("data-index");
        if (idx == null) return;
        let isQuick = $(this).attr("data-quick") == "1";
        if (!(idx in seen)) { seen[idx] = btns.length; btns.push(this); }
        else if (isQuick) { btns[seen[idx]] = this; }
    });
    if (this.auto_arena) {
        if (btns.length > 0 && GAME.timed == 0) {
            let $btn = $(btns[0]);
            let quick = $btn.attr("data-quick") == "1" ? 1 : 0;
            let payload = { a: 46, type: 1, index: parseInt($btn.attr("data-index")) };
            if (quick) payload.quick = 1;
            // normalna walka (bez błyskawicznej) otwiera okno walki - nie pokazujemy go
            if (!quick) this.hideFightWindow();
            GAME.socket.emit('ga', payload);
            setTimeout(() => {
                this.attackAutoArena();
            }, 50);
        } else {
            setTimeout(() => {
                this.manageAutoArena();
            }, 500);
        }
    } else {
        this.stopAutoArena();
    }
};

Assistant.prototype.stopAutoArena = function () {
    this.auto_arena = false;
    $(".qlink.manage_auto_arena").removeClass("swa_active_icon");
};

