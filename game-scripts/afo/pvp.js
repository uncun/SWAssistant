/* global assistant */
if (typeof GAME !== 'undefined') {

var PVP = {
    stop: true,
    wi: false,
    org: false,
    war_list: 0,
    war_cnt: 0,
    charState: {},
    komBusy: false,
    attacked_ids: {},
    emp : 0,
    wk: false,
    wait_pvp: 10,
    WSP: 50,
    killing: false,
    war: false,
    buff_imp: false,
    buff_clan: false,
    chars:[],
    start_char_id:null,
    // --- cykl postaci: sync -> war -> wk -> org -> attack -> patrol -> clear -> idle_cd -> switch <-> verify_switch ---
    phase:'sync',
    cycle_attacked:false,     // czy w bieżącym cyklu padł jakikolwiek atak
    cycle_attacked_ids:{},    // kogo zaatakowaliśmy w tym cyklu (nie czekamy na CD, które sami nabiliśmy)
    dry_cycles:0,             // kolejne cykle (różnych postaci) bez żadnego ataku
    war_attempts:0,           // próby wypowiedzenia wojny w bieżącym cyklu
    clear_until:0,            // limit czasu doczyszczania pola po powrocie na start
    clear_cd_log_next:0,
    pa_skip_log_next:0,       // throttle logu o pominięciu postaci z za małym PA
    next_switch_at:0,         // najwcześniejszy moment zmiany postaci (CD po cyklu bez walki)
    switch_target:null,
    switch_attempts:0,        // nieudane próby bieżącej zmiany postaci
    next_switch_try_at:0,     // najwcześniejszy moment kolejnej próby po nieudanym przelogowaniu
    last_switch_ok_at:0,      // ostatnie udane przelogowanie (odstęp minimalny między zmianami)
    switch_gap_log_next:0,
    last_tile:'',
    stale_enemy_count:null,
    stale_enemy_since:0,
    emp_wars_next_refresh:0,
    war_cooldown_log_next:0,
    emp_leaders:{},
    trasa:false,              // chodzenie po zaznaczonych kratkach
    patrol_phase:'idle',      // idle -> walk -> return -> done
    patrol_route:[],
    patrol_idx:0,
    patrol_start:null,        // {x,y} skąd wystartowała bieżąca postać
    patrol_path:null,         // ścieżka BFS (lista kierunków) do bieżącego celu
    patrol_walking:false,
    patrol_step_fails:0,
    patrol_started_at:0,
    patrol_loc:0,
    patrol_verify_wait:40,   // ms - czekanie po wysłaniu kroku, zanim sprawdzimy czy pozycja się zmieniła (mniej = szybciej marsz)
    patrol_step_gap:20,       // ms - przerwa przed kolejnym krokiem trasy
};
PVP.EMP_WARS_REFRESH_INTERVAL = 15;
PVP.WAR_COOLDOWN_SANITY_LIMIT = 7 * 24 * 3600;
PVP.TICK = 100;                 // ms: bazowy takt pętli cyklu
PVP.SWITCH_IDLE_CD = 20;        // s: odstęp przed zmianą postaci, gdy cykl przeszedł bez walki
PVP.SWITCH_VERIFY_DELAY = 4000; // ms: ile czekamy na wejście na nową postać przed weryfikacją
PVP.SWITCH_RETRY_GAP = 60;      // s: odstęp między kolejnymi próbami, gdy przelogowanie nie weszło
PVP.SWITCH_MAX_ATTEMPTS = 5;    // po tylu nieudanych próbach zmiany odpuszczamy i robimy cykl na obecnej postaci
PVP.CLEAR_TIMEOUT = 30;         // s: limit doczyszczania pola po powrocie na start
PVP.CLEAR_CD_MAX_WAIT = 0;      // s: max CD przeciwnika na polu, na który jeszcze czekamy zamiast zmienić postać (0 = nie czekamy, natychmiast rotacja)
PVP.WAR_ATTEMPTS_MAX = 12;      // limit prób wypowiedzenia wojny w jednym cyklu
PVP.CAP_TTL = 86400;            // uprawnienia sprawdzamy raz dziennie
PVP.CAP_STORAGE_KEY = 'swa_pvp_caps';
PVP.ORG_HIRE_ATTEMPTS = 5;      // ile prób odczytu wyniku najmu (rejestr/OK)
PVP.ORG_HIRE_RETRY = 20;        // s: bufor między najmem a odświeżeniem emp_wars (>15s refresh)
PVP.RAPS_LIMIT = 500;           // kasuj wszystkie raporty, gdy jest ich co najmniej tyle
PVP.PA_MIN = 300;               // postać z mniejszym PA jest pomijana w rotacji
PVP.RAPS_CHECK_INTERVAL = 300;  // s: jak często sprawdzać liczbę raportów
PVP.raps_next_check = 0;
PVP.raps_check_pending = false;
PVP.RAMEN_PA_MIN = 400;          // gdy PA spadnie poniżej tej wartości, jemy rameny
PVP.RAMEN_TIERS = [1, 41, 42];   // item_id ramenów od najniższego tieru do najwyższego (mały -> powiększony -> ogromny)
PVP.RAMEN_STEP_GAP = 250;        // ms: przerwa między kolejnymi ramenami
PVP.ramen_feeding = false;

PVP.loadCaps = () => {
    try { return JSON.parse(localStorage.getItem(PVP.CAP_STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
};
PVP.saveCap = (kind, cap) => {
    var caps = PVP.loadCaps();
    if (!caps[GAME.char_id]) caps[GAME.char_id] = {};
    caps[GAME.char_id][kind] = cap;
    try { localStorage.setItem(PVP.CAP_STORAGE_KEY, JSON.stringify(caps)); } catch (e) { return; }
};
PVP.newCharState = () => {
    var s = { warCooldownUntil: 0, warCap: null, orgCap: null, orgProgress: {} };
    var caps = PVP.loadCaps()[GAME.char_id];
    if (caps) { s.warCap = caps.war || null; s.orgCap = caps.org || null; }
    return s;
};
PVP.cs = () => {
    var id = GAME.char_id;
    if (!PVP.charState[id]) PVP.charState[id] = PVP.newCharState();
    return PVP.charState[id];
};
PVP.getCap = (kind) => {
    var cap = kind === 'war' ? PVP.cs().warCap : PVP.cs().orgCap;
    if (cap && (GAME.getTime() - cap.at) < PVP.CAP_TTL) return cap.allowed;
    return null;
};
PVP.setCap = (kind, allowed) => {
    var cap = { allowed: allowed, at: GAME.getTime() };
    if (kind === 'war') PVP.cs().warCap = cap; else PVP.cs().orgCap = cap;
    PVP.saveCap(kind, cap);
};
PVP.refreshEmpWars = () => {
    if (GAME.getTime() < PVP.emp_wars_next_refresh) return;
    PVP.emp_wars_next_refresh = GAME.getTime() + PVP.EMP_WARS_REFRESH_INTERVAL;
    GAME.socket.emit('ga', { a: 50, type: 0, empire: GAME.char_data.village_id });
};
PVP.checkkkk = () => {
    let imp = $("#leader_player").find("[data-option=show_player]").attr("data-char_id");
    
    let buff = $(".emp_buff .pull-right").find("button").attr("data-option") == "activate_emp_buff";
    let buff_id = $(".emp_buff .pull-right").find("button").attr("data-buff");
    let who_win = $("#gne_satus").text().includes("ZŁO");
    let abut = $("#clan_buffs").find(`button[data-option="activate_war_buff"]`);
    let isDisabled = $("#clan_buffs").find(`button[data-option="activate_war_buff"]`).parents("tr").hasClass("disabled");
    PVP.emp = GAME.char_data.village_id;

    if (GAME.quick_opts.ssj && $("#ssj_bar").css("display") === "none" && PVP.code) {
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 18,
                type: 5,
                tech_id: GAME.quick_opts.ssj[0]
            });
        }, 1500);
        return true;
    } else if ($('#ssj_status').text() == "--:--:--" && PVP.code && GAME.quick_opts.ssj) {
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 18,
                type: 6
            });
        }, 1500);
        return true;
    } else if ($('#ssj_status').text() <= '00:00:05' && PVP.code && GAME.quick_opts.ssj) {
        return true;
    } else if ($("#train_uptime").find('.timer').length == 0 && !GAME.is_training && PVP.code) {
        GAME.socket.emit('ga', {
            a: 8,
            type: 2,
            stat: 1,
            duration: 1
        });
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 8,
                type: 5,
                apud: 'vzaaa'
            });
        }, 1600);
        return true;
    } else if (GAME.is_training && $("#train_uptime").find('.timer').length == 1 && PVP.code) {
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 8,
                type: 3
            });
        }, 1600);
        return true;
    } else if (GAME.is_training && PVP.code) {
        GAME.socket.emit('ga', {
            a: 8,
            type: 3
        });
        return true;
    } else if (imp == GAME.char_id && PVP.buff_imp && buff && buff_id < 4) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 6,
            buff: buff_id
        });
        return true;
    } else if (imp == GAME.char_id && PVP.buff_imp && buff && buff_id < 7 && ((PVP.emp == 1 || PVP.emp == 3) && who_win)) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 6,
            buff: buff_id
        });
        return true;
    } else if (imp == GAME.char_id && PVP.buff_imp && buff && buff_id < 7 && ((PVP.emp == 2 || PVP.emp == 4) && !who_win)) {
        GAME.socket.emit('ga', {
            a: 50,
            type: 6,
            buff: buff_id
        });
        return true;
    } else if ((PVP.buff_clan || PVP.buff_imp) && $("#server_time").text() > '00:05:00' && $("#server_time").text() < '01:00:00' && typeof this.loaded == 'undefined') {
        this.loaded = true;
        setTimeout(() => {
            GAME.socket.emit('ga', {
                a: 50,
                type: 0,
                empire: GAME.char_data.empire
            });
        }, 300);
        setTimeout(() => {
            GAME.emitOrder({
                a: 39,
                type: 0
            });
        }, 600);
        setTimeout(() => {
            GAME.emitOrder({
                a: 39,
                type: 23
            });
        }, 900);
        return true;
    } else if (PVP.buff_clan && GAME.klan_data != undefined && abut.length && !isDisabled) {
        $(" .newBtn.activate_all_clan_buffs").click();
        return true;
    }
    return false;
};
// ---------------- ZAGADKA ANTYBOTOWA ----------------
PVP.ab_path = false;        // pozostałe kroki (kierunki) do rozwiązania zagadki
PVP.ab_savedPos = false;    // kratka, na której skrypt został zatrzymany przez zagadkę
PVP.ab_returning = false;   // czy wracamy na zapisaną kratkę po rozwiązaniu
PVP.ab_returnNextAt = 0;    // kiedy wolno wysłać kolejny krok powrotu
PVP.AB_RETURN_WAIT = 300;   // ms - odstęp między krokami powrotu, żeby serwer zdążył zaktualizować pozycję

PVP.abDir = (x, y, nx, ny) => {
    x = parseInt(x); y = parseInt(y); nx = parseInt(nx); ny = parseInt(ny);
    if (x > nx && y > ny) return 6;
    if (x === nx && y > ny) return 2;
    if (x < nx && y > ny) return 5;
    if (x > nx && y === ny) return 8;
    if (x < nx && y === ny) return 7;
    if (x > nx && y < ny) return 4;
    if (x === nx && y < ny) return 1;
    if (x < nx && y < ny) return 3;
};

PVP.abFind = (x, y, path, p, tX, tY) => {
    x = parseInt(x); y = parseInt(y); tX = parseInt(tX); tY = parseInt(tY);
    var cP = x + '_' + y;
    if (x === tX && y === tY) return path.concat([cP]);
    var neigh = [[x - 1, y - 1], [x, y - 1], [x + 1, y - 1], [x - 1, y], [x + 1, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1]];
    for (var i = 0; i < neigh.length; i++) {
        var key = neigh[i][0] + '_' + neigh[i][1];
        if (path.indexOf(key) === -1 && p[key] === 1) {
            var r = PVP.abFind(neigh[i][0], neigh[i][1], path.concat([cP]), p, tX, tY);
            if (r) return r;
        }
    }
    return false;
};

PVP.abMoves = (result) => {
    var moves = [];
    for (var i = 0; i < result.length - 1; i++) {
        var a = result[i].split('_'), b = result[i + 1].split('_');
        var d = PVP.abDir(a[0], a[1], b[0], b[1]);
        if (d) moves.push(d);
    }
    return moves;
};

PVP.abFinalPos = (premiumData) => {
    var key = Object.keys(premiumData).filter((k) => premiumData[k] === 2)[0];
    return key ? key.split('_') : null;
};

PVP.hasAntybot = () => {
    var pd = GAME.premiumData;
    if (pd === undefined || pd === null) return false;
    return Object.keys(pd).some((k) => pd[k] === 2);
};
PVP.solveAntybot = () => {
    if (!PVP.ab_savedPos) PVP.ab_savedPos = { x: GAME.char_data.x, y: GAME.char_data.y };

    var x = GAME.char_data.x, y = GAME.char_data.y;
    var premiumData = Object.assign({}, GAME.premiumData);
    premiumData[x + '_' + y] = 1;

    var finalPos = PVP.abFinalPos(premiumData);
    if (!finalPos) { PVP.ab_path = false; PVP.ab_returning = true; window.setTimeout(PVP.start, PVP.wait_pvp / PVP.WSPP()); return; }
    var tX = finalPos[0], tY = finalPos[1];

    if (!PVP.ab_path) {
        var p = Object.assign({}, premiumData);
        p[tX + '_' + tY] = 1;
        var result = PVP.abFind(x, y, [], p, tX, tY);
        PVP.ab_path = (result && PVP.abMoves(result)) || [];
    }

    var dir = PVP.ab_path.shift();
    if (dir) {
        GAME.emitOrder({ a: 4, dir: dir, vo: GAME.map_options.vo });
    } else {
        PVP.ab_path = false;
        PVP.ab_returning = true;
    }
    window.setTimeout(PVP.start, PVP.wait_pvp / PVP.WSPP());
};
PVP.returnToSavedPos = () => {
    if (!PVP.ab_savedPos) {
        PVP.ab_returning = false;
        window.setTimeout(PVP.start, PVP.wait_pvp / PVP.WSPP());
        return;
    }
    var x = GAME.char_data.x, y = GAME.char_data.y;
    if (x === PVP.ab_savedPos.x && y === PVP.ab_savedPos.y) {
        PVP.ab_savedPos = false;
        PVP.ab_returning = false;
        PVP.ab_returnNextAt = 0;
        window.setTimeout(PVP.start, PVP.wait_pvp / PVP.WSPP());
        return;
    }
    if (Date.now() >= PVP.ab_returnNextAt) {
        PVP.ab_returnNextAt = Date.now() + PVP.AB_RETURN_WAIT;
        var path = (GAME.current_loc && GAME.mapcell) ? PVP.bfsPath(x, y, PVP.ab_savedPos.x, PVP.ab_savedPos.y) : null;
        var dir = (path && path.length) ? path[0] : PVP.abDir(x, y, PVP.ab_savedPos.x, PVP.ab_savedPos.y); // fallback: linia prosta
        if (dir) GAME.emitOrder({ a: 4, dir: dir, vo: GAME.map_options.vo });
    }
    window.setTimeout(PVP.start, PVP.wait_pvp / PVP.WSPP());
};
// ----------------------------------------------------
PVP.start = () => {
    if (PVP.stop) return;
    if (GAME.is_loading) { window.setTimeout(PVP.start, 200); return; }
    if (PVP.hasAntybot()) { PVP.solveAntybot(); return; }
    if (PVP.ab_returning) { PVP.returnToSavedPos(); return; }
    if ($("#player_list_con").find("[data-option=load_more_players]").length != 0) {
        $("#player_list_con").find("[data-option=load_more_players]").click();
    }
    PVP.tick();
};

PVP.beginCycle = (keepPatrol) => {
    PVP.phase = 'sync';
    PVP.war_attempts = 0;
    PVP.attacked_ids = {};
    PVP.cycle_attacked_ids = {};
    // keepPatrol: nie zerujemy patrolu, gdy tylko powtarzamy cykl na tej samej postaci
    // (bez zmiany postaci) - dzięki temu trasę przechodzimy raz, a nie w kółko.
    // Ponowny marsz odblokowuje dopiero zmiana postaci (switchChar) lub zmiana mapy.
    if (!keepPatrol) PVP.resetPatrol();
};

PVP.tick = () => {
    var tile = GAME.char_data.x + '_' + GAME.char_data.y;
    if (tile !== PVP.last_tile) { PVP.last_tile = tile; PVP.attacked_ids = {}; }

    PVP.feedRamens();

    if (!PVP.isHiddenVillage() && !PVP.killing && PVP.freshEnemies().length > 0) PVP.kill_players1();

    var switching = PVP.phase === 'switch' || PVP.phase === 'verify_switch';
    if (!switching) {
        if (!PVP.isHiddenVillage()) PVP.checkStaleEnemies(PVP.attackableEnemies().length);
        PVP.clean_raps();
        PVP.watchWarList();
    }

    var handler = PVP['phase_' + PVP.phase];
    if (!handler) { PVP.beginCycle(); handler = PVP.phase_sync; }
    window.setTimeout(PVP.start, handler());
};

PVP.phase_sync = () => {
    if (PVP.checkkkk()) return 1800;
    PVP.phase = 'war';
    return PVP.TICK;
};

PVP.phase_war = () => {
    PVP.refreshEmpWars();
    if (!PVP.wi || !PVP.canDeclareWar()) { PVP.phase = 'wk'; return PVP.TICK; }
    if (PVP.komBusy) return 300;

    var cs = PVP.cs();
    if (GAME.getTime() < cs.warCooldownUntil) {
        var remaining = cs.warCooldownUntil - GAME.getTime();
        if (remaining > PVP.WAR_COOLDOWN_SANITY_LIMIT) {
            console.log("dec wars - cooldown nieprawidłowy (" + remaining + "s), resetuję");
            cs.warCooldownUntil = 0;
            return PVP.TICK;
        }
        if (GAME.getTime() >= PVP.war_cooldown_log_next) {
            PVP.war_cooldown_log_next = GAME.getTime() + 60;
            console.log("dec wars - cooldown, czekam jeszcze " + remaining + "s (" + Math.round(remaining / 60) + " min)");
        }
        PVP.phase = 'wk';
        return PVP.TICK;
    }
    var target = PVP.nextWarTarget();
    if (target == null || PVP.war_attempts >= PVP.WAR_ATTEMPTS_MAX) { PVP.phase = 'wk'; return PVP.TICK; }
    if (GAME.is_loading) return 300;    // emitOrder zostałby po cichu porzucony

    PVP.war_attempts++;
    var empWarsSeen = $('#emp_wars .war_win').length;
    console.log("dec wars - wypowiadam wojnę " + target + " (postać " + GAME.char_id + ", widzę " + empWarsSeen + " aktywnych wojen w panelu)");
    var actingChar = GAME.char_id;
    $('#kom_con .kom').remove();
    PVP.komBusy = true;
    GAME.emitOrder({a:50,type:7,target:target});
    PVP.war_cnt = target + 1;
    setTimeout(() => PVP.checkWarCooldownMsg(actingChar, empWarsSeen), 500);
    return 1500;
};

PVP.phase_wk = () => {
    if (PVP.wk && GAME.is_loading) return 300;    // emitOrder zostałby po cichu porzucony
    PVP.phase = 'org';
    if (PVP.wk && $("#war_list .timer").length === 0) {
        var clanShort = PVP.war || PVP.clan_list();
        if (clanShort) {
            console.log("PVP cykl - wypowiadam wojny klanowe (" + clanShort + ")");
            GAME.emitOrder({a:39,type:24,shorts:clanShort});
        }
        GAME.loadMapJson(function() {
            GAME.socket.emit('ga', { a: 3, vo: GAME.map_options.vo }, 1);
        });
        return 800;
    }
    return PVP.TICK;
};

PVP.phase_org = () => {
    if (!PVP.org || PVP.getCap('org') === false) { PVP.phase = 'attack'; return PVP.TICK; }
    if (PVP.komBusy) return 300;
    PVP.refreshEmpWars();

    var org_id = $("#pvp_Panel select[name=org_id]").val();
    if (!org_id) org_id = PVP.savedOrgId();

    var progress = PVP.cs().orgProgress;
    var needing = PVP.warsNeedingOrg();
    var target = null;
    for (var i = 0; i < needing.length; i++) {
        var ts = progress[needing[i]];
        if (ts && (GAME.getTime() - ts) < PVP.ORG_HIRE_RETRY) continue;
        target = needing[i];
        break;
    }
    if (!target) { PVP.phase = 'attack'; return PVP.TICK; }
    if (GAME.is_loading) return 300;    // emitOrder zostałby po cichu porzucony

    var actingChar = GAME.char_id;
    PVP.komBusy = true;
    console.log("org - org_id=" + org_id + " cel=" + target + " (" + needing.length + " naszych wojen bez organizacji)");
    setTimeout(() => {
        if (actingChar !== GAME.char_id) { PVP.komBusy = false; return; }
        $('#kom_con .kom').remove();
        GAME.emitOrder({a:50,type:13,war:target,org:org_id});
        setTimeout(() => PVP.waitForOrgHireResult(target, PVP.ORG_HIRE_ATTEMPTS, actingChar), 300);
    }, 100);
    return 500;
};

PVP.phase_attack = () => {
    if (!PVP.hasEnoughPa()) {
        if (GAME.getTime() >= PVP.pa_skip_log_next) {
            PVP.pa_skip_log_next = GAME.getTime() + 30;
            console.log("PVP - postać " + GAME.char_id + " ma za mało PA (" + (GAME.char_data ? GAME.char_data.pr : '?') + " < " + PVP.PA_MIN + "), nie atakuję, rotuję dalej");
        }
        PVP.phase = 'patrol';
        return PVP.TICK;
    }
    if (!PVP.isHiddenVillage() && (PVP.killing || PVP.freshEnemies().length > 0)) return 250;
    PVP.phase = 'patrol';
    return PVP.TICK;
};

PVP.phase_patrol = () => {
    var toClear = () => {
        PVP.phase = 'clear';
        PVP.clear_until = GAME.getTime() + PVP.CLEAR_TIMEOUT;
        return PVP.TICK;
    };
    if (!PVP.trasa || !GAME.current_loc || !GAME.mapcell || PVP.routeTiles().length === 0) return toClear();
    // zmiana mapy - nawet po zakończonej trasie pozwól przejść ją od nowa na nowej lokacji
    if (PVP.patrol_loc && GAME.current_loc.id != PVP.patrol_loc) PVP.resetPatrol();
    if (PVP.patrol_phase == 'done') return toClear();
    if (PVP.patrol_phase == 'idle') {
        if (!PVP.hasEnoughPa()) {
            console.log("PVP trasa - postać " + GAME.char_id + " ma za mało PA (" + GAME.char_data.pr + " < " + PVP.PA_MIN + "), pomijam trasę");
            return toClear();
        }

        PVP.buildRoute();
        if (!PVP.patrol_route.length) return toClear();
        PVP.patrol_start = { x: GAME.char_data.x, y: GAME.char_data.y };
        PVP.patrol_loc = GAME.current_loc.id;
        PVP.patrol_started_at = GAME.getTime();
        PVP.patrol_phase = 'walk';
        console.log("PVP trasa - start: " + PVP.patrol_route.length + " kratek, powrót na " + PVP.patrol_start.x + "|" + PVP.patrol_start.y);
    }
    if (PVP.patrol_started_at && GAME.getTime() - PVP.patrol_started_at > PVP.PATROL_TIMEOUT) {
        console.log("PVP trasa - limit czasu trasy przekroczony, kończę cykl mimo niedokończonej trasy");
        PVP.patrol_phase = 'done';
        return toClear();
    }
    if (GAME.current_loc.id != PVP.patrol_loc) { PVP.resetPatrol(); return PVP.TICK; }  // zmiana mapy w trakcie - trasa od nowa
    if (!PVP.patrol_walking) PVP.patrol_walk();
    return 250;
};

PVP.parseTimer = (t) => {
    var p = (t || '').trim().split(':');
    if (p.length !== 3) return null;
    var s = (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]);
    return isNaN(s) ? null : s;
};

PVP.soonestWaitableCd = () => {
    if (PVP.isHiddenVillage()) return null;
    var best = null;
    $("#player_list_con .player").each(function () {
        var id = $(this).find("[data-char_id]").attr("data-char_id");
        if (!id || PVP.isOwnChar(id) || PVP.cycle_attacked_ids[id]) return;
        var s = PVP.parseTimer($(this).find(".timer").text());
        if (s != null && s > 0 && (best === null || s < best)) best = s;
    });
    return best;
};

PVP.phase_clear = () => {
    var fighting = !PVP.isHiddenVillage() && (PVP.killing || PVP.freshEnemies().length > 0);
    if (fighting && GAME.getTime() < PVP.clear_until) return 500;
    if (fighting) console.log("PVP cykl - pole nieczyste po " + PVP.CLEAR_TIMEOUT + "s, kończę cykl mimo to");

    var cd = PVP.soonestWaitableCd();
    if (cd != null && cd <= PVP.CLEAR_CD_MAX_WAIT) {
        if (GAME.getTime() >= PVP.clear_cd_log_next) {
            PVP.clear_cd_log_next = GAME.getTime() + 30;
            console.log("PVP cykl - przeciwnik na polu z CD " + cd + "s, czekam na koniec CD zamiast zmieniać postać");
        }
        PVP.clear_until = GAME.getTime() + PVP.CLEAR_TIMEOUT;  // po zejściu CD zostaje czas na dobicie
        return 1000;
    }

    if (PVP.cycle_attacked) PVP.dry_cycles = 0; else PVP.dry_cycles++;
    var hadFight = PVP.cycle_attacked;
    PVP.cycle_attacked = false;   // ataki od tego momentu liczą się do następnego cyklu

    if (!PVP.zmieniaj) { PVP.beginCycle(true); return 1000; }

    PVP.next_switch_at = GAME.getTime() + (hadFight ? 0 : PVP.SWITCH_IDLE_CD);
    if (!hadFight) console.log("PVP cykl - postać " + GAME.char_id + " bez walki, czekam " + PVP.SWITCH_IDLE_CD + "s przed zmianą");
    PVP.phase = 'idle_cd';
    return PVP.TICK;
};

PVP.phase_idle_cd = () => {
    if (GAME.getTime() < PVP.next_switch_at) return 500;
    PVP.phase = 'switch';
    return PVP.TICK;
};

PVP.phase_switch = () => {
    PVP.chars = PVP.enabledChars();
    if (PVP.chars.length === 0) {
        console.log("PVP zmieniaj - brak włączonych postaci, czekam");
        return 5000;
    }

    if (GAME.getTime() < PVP.next_switch_try_at) return 1000;
    if (GAME.is_loading) return 300;

    var cur = String(GAME.char_id);
    var target = null;
    if (PVP.switch_attempts > 0 && PVP.switch_target && PVP.chars.indexOf(String(PVP.switch_target)) !== -1) {
        target = String(PVP.switch_target);   // ponawiamy przerwaną zmianę na ten sam cel
    }
    if (!target && PVP.wi && PVP.dry_cycles >= PVP.chars.length) {
        var wc = PVP.warCharId();
        if (wc && wc !== cur) {
            target = wc;
            console.log("PVP zmieniaj - cała kolejka bez walki, wracam na postać od wojen (" + wc + ")");
        }
        PVP.dry_cycles = 0;
    }
    if (!target) {
        var idx = PVP.chars.indexOf(cur);
        target = PVP.chars[(idx + 1) % PVP.chars.length];
    }
    if (target === cur) { PVP.switch_attempts = 0; PVP.beginCycle(); return 1000; }

    console.log("PVP zmieniaj - zmiana postaci " + cur + " -> " + target + (PVP.switch_attempts > 0 ? " (próba " + (PVP.switch_attempts + 1) + "/" + PVP.SWITCH_MAX_ATTEMPTS + ")" : ""));
    PVP.switch_target = target;
    PVP.switchChar(parseInt(target));
    PVP.phase = 'verify_switch';
    return PVP.SWITCH_VERIFY_DELAY;
};

PVP.phase_verify_switch = () => {
    if (String(GAME.char_id) === String(PVP.switch_target)) {
        PVP.last_switch_ok_at = GAME.getTime();
        PVP.switch_attempts = 0;
        PVP.next_switch_try_at = 0;
        PVP.beginCycle();
        return 1000;
    }
    PVP.switch_attempts++;
    if (PVP.switch_attempts < PVP.SWITCH_MAX_ATTEMPTS) {
        console.log("PVP zmieniaj - przełączenie na " + PVP.switch_target + " nie weszło, zostaję na miejscu i ponawiam za " + PVP.SWITCH_RETRY_GAP + "s (" + PVP.switch_attempts + "/" + PVP.SWITCH_MAX_ATTEMPTS + ")");
        PVP.next_switch_try_at = GAME.getTime() + PVP.SWITCH_RETRY_GAP;
        PVP.phase = 'switch';
        return 1000;
    }
    console.log("PVP zmieniaj - " + PVP.SWITCH_MAX_ATTEMPTS + " nieudanych prób przełączenia na " + PVP.switch_target + ", odpuszczam i robię cykl na " + GAME.char_id);
    PVP.switch_attempts = 0;
    PVP.next_switch_try_at = 0;
    PVP.beginCycle();
    return 1000;
};

PVP.warCharId = () => {
    var chars = PVP.enabledChars();
    if (PVP.hasLeaderData()) {
        for (var i = 0; i < chars.length; i++) {
            if (PVP.isWarLord(chars[i])) return chars[i];
        }
        return null;
    }
    if (PVP.start_char_id != null && chars.indexOf(String(PVP.start_char_id)) !== -1) return String(PVP.start_char_id);
    return null;
};

PVP.watchWarList = () => {
    var n = $("#ewar_list .timer").length;
    if (PVP.war_list !== n) {
        PVP.war_list = n;
        GAME.loadMapJson(function() {
            GAME.socket.emit('ga', { a: 3, vo: GAME.map_options.vo }, 1);
        });
    }
};
PVP.isHiddenVillage = () => {
    return $('#map_name').text().trim().toLowerCase().indexOf('ukryta wiosk') !== -1;
};

PVP.ownCharIds = () => {
    var ids = [];
    $("li[data-option=select_char]").each(function () {
        var id = $(this).attr("data-char_id");
        if (id) ids.push(id);
    });
    return ids;
};

PVP.enabledChars = () => {
    var enabled = {};
    try { enabled = JSON.parse(localStorage.getItem('swa_pvp_chars_enabled')) || {}; } catch (e) { enabled = {}; }
    var chars = [];
    for (var i = 0; i < GAME.player_chars; i++) {
        var charId = $("li[data-option=select_char]").eq(i).attr("data-char_id");
        if (!charId) continue;
        var isOn = !(charId in enabled) || enabled[charId];
        if (isOn) chars.push(charId);
    }
    return chars;
};
PVP.isOwnChar = (charId) => {
    return PVP.ownCharIds().indexOf(String(charId)) !== -1;
};
PVP.attackableEnemies = () => {
    // jeden przycisk na przeciwnika - preferuj błyskawiczną walkę, gdy dostępna,
    // ale atakuj też normalnie (bez błyskawicznej) gdy przycisku quick nie ma
    var seen = {}, els = [];
    $("#player_list_con").find(".player")
        .find("button[data-option=pvp_attack], button[data-option=gpvp_attack]")
        .filter(":not(.initial_hide_forced)")
        .each(function () {
            var id = $(this).attr("data-char_id");
            if (!id || PVP.isOwnChar(id)) return;
            var isQuick = $(this).attr("data-quick") == "1";
            if (!(id in seen)) { seen[id] = els.length; els.push(this); }
            else if (isQuick) { els[seen[id]] = this; }
        });
    return $(els);
};

PVP.enemiesPresent = () => {
    if (PVP.isHiddenVillage()) return false;
    var present = false;
    $("#player_list_con").find(".player")
        .find("button[data-option=pvp_attack], button[data-option=gpvp_attack]")
        .each(function () {
            var id = $(this).attr("data-char_id");
            if (id && !PVP.isOwnChar(id)) present = true;
        });
    return present;
};
PVP.freshEnemies = () => {
    if (!PVP.hasEnoughPa()) return $();
    return PVP.attackableEnemies().filter(function () {
        return !PVP.attacked_ids[$(this).attr("data-char_id")];
    });
};

PVP.attackButton = ($btn) => {
    var charId = parseInt($btn.attr("data-char_id"));
    var opt = $btn.attr("data-option") || '';
    var quick = $btn.attr("data-quick") == "1" ? 1 : 0;
    PVP.attacked_ids[$btn.attr("data-char_id")] = true;
    PVP.cycle_attacked_ids[$btn.attr("data-char_id")] = true;
    PVP.cycle_attacked = true;
    var payload = { a: 24, char_id: charId };
    if (opt.indexOf("gxxx") !== -1 || opt.indexOf("gpvp") !== -1) payload.type = 1;
    if (quick) payload.quick = 1;
    // normalna walka (bez błyskawicznej) otwiera okno walki - nie pokazujemy go
    if (!quick && typeof assistant !== 'undefined' && assistant.hideFightWindow) assistant.hideFightWindow();
    GAME.socket.emit('ga', payload);
};

PVP.refreshPlayerList = () => {
    PVP.attacked_ids = {};
    GAME.loadMapJson(function () {
        GAME.socket.emit('ga', {
            a: 3,
            vo: GAME.map_options.vo
        }, 1);
    });
};
PVP.STALE_ENEMY_TIMEOUT = 5;
PVP.checkStaleEnemies = (count) => {
    if (count !== PVP.stale_enemy_count) {
        PVP.stale_enemy_count = count;
        PVP.stale_enemy_since = GAME.getTime();
        return;
    }
    if (count > 0 && GAME.getTime() - PVP.stale_enemy_since >= PVP.STALE_ENEMY_TIMEOUT) {
        console.log("PVP - lista przeciwników (" + count + ") nie zmienia się od " + PVP.STALE_ENEMY_TIMEOUT + "s, odświeżam");
        PVP.stale_enemy_since = GAME.getTime();
        PVP.refreshPlayerList();
    }
};
PVP.kill_players1 = () => {
    if (PVP.isHiddenVillage()) {
        PVP.killing = false;
        kom_clear();
        return;
    }
    if (JQS.chm.is(":focus")) {
        PVP.killing = false;
        return;
    }
    if ($("#player_list_con").find("[data-option=load_more_players]").length == 1) {
        $("#player_list_con").find("[data-option=load_more_players]").click();
        PVP.killing = true;
        window.setTimeout(PVP.kill_players1, 50);
        return;
    }
    PVP.checkStaleEnemies(PVP.attackableEnemies().length);
    var fresh = PVP.freshEnemies();
    if (fresh.length > 0) {
        PVP.attackButton(fresh.eq(0));
        PVP.killing = true;
        window.setTimeout(PVP.kill_players1, 20);
    } else {
        PVP.killing = false;
        kom_clear();
    }
};
PVP.switchChar = (charId) => {
    PVP.resetPatrol();
    GAME.emitOrder({ a: 2, char_id: charId });
};

PVP.ROUTE_STORAGE_KEY = 'swa_pvp_route_tiles';
PVP.PATROL_TIMEOUT = 900;       // s: limit trasy na postać, potem rotacja mimo wszystko
PVP.PATROL_STEP_RETRIES = 6;    // nieudanych kroków z rzędu zanim pominiemy kratkę
PVP.loadRouteMap = () => {
    try { return JSON.parse(localStorage.getItem(PVP.ROUTE_STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
};
PVP.saveRouteTiles = (locId, tiles) => {
    var m = PVP.loadRouteMap();
    if (tiles && tiles.length) m[locId] = tiles; else delete m[locId];
    try { localStorage.setItem(PVP.ROUTE_STORAGE_KEY, JSON.stringify(m)); } catch (e) { return; }
};
PVP.routeTiles = () => {
    if (!GAME.current_loc) return [];
    return PVP.loadRouteMap()[GAME.current_loc.id] || [];
};
PVP.cellWalkable = (x, y) => {
    var c = GAME.mapcell && GAME.mapcell[x + '_' + y];
    return !!c && c.m != 0;
};
PVP.resetPatrol = () => {
    PVP.patrol_phase = 'idle';
    PVP.patrol_route = [];
    PVP.patrol_idx = 0;
    PVP.patrol_start = null;
    PVP.patrol_path = null;
    PVP.patrol_walking = false;
    PVP.patrol_step_fails = 0;
    PVP.patrol_started_at = 0;
    PVP.patrol_loc = 0;
};
PVP.buildRoute = () => {
    var tiles = PVP.routeTiles(), rows = {};
    for (var i = 0; i < tiles.length; i++) {
        var p = tiles[i].split('_'), x = parseInt(p[0]), y = parseInt(p[1]);
        if (!PVP.cellWalkable(x, y)) continue;
        (rows[y] = rows[y] || []).push(x);
    }
    var ys = Object.keys(rows).map(Number).sort((a, b) => a - b);
    var route = [], flip = false;
    for (var j = 0; j < ys.length; j++) {
        var xs = rows[ys[j]].sort((a, b) => flip ? b - a : a - b);
        for (var k = 0; k < xs.length; k++) route.push({ x: xs[k], y: ys[j] });
        flip = !flip;
    }
    PVP.patrol_route = route;
    PVP.patrol_idx = 0;
};

PVP.bfsPath = (sx, sy, tx, ty) => {
    if (!PVP.cellWalkable(tx, ty)) return null;
    if (sx == tx && sy == ty) return [];
    var maxx = GAME.current_loc.x_max, maxy = GAME.current_loc.y_max;
    var prev = {}, queue = [[sx, sy]];
    prev[sx + '_' + sy] = true;
    var dirs = [[0, 1, 1], [0, -1, 2], [1, 0, 7], [-1, 0, 8]];  // dol, gora, prawo, lewo
    while (queue.length) {
        var c = queue.shift();
        if (c[0] == tx && c[1] == ty) break;
        for (var i = 0; i < 4; i++) {
            var nx = c[0] + dirs[i][0], ny = c[1] + dirs[i][1];
            if (nx < 1 || ny < 1 || nx > maxx || ny > maxy) continue;
            var k = nx + '_' + ny;
            if (prev[k] || !PVP.cellWalkable(nx, ny)) continue;
            prev[k] = { from: c, dir: dirs[i][2] };
            queue.push([nx, ny]);
        }
    }
    var e = prev[tx + '_' + ty];
    if (!e || e === true) return null;
    var path = [], cur = [tx, ty];
    while (!(cur[0] == sx && cur[1] == sy)) {
        e = prev[cur[0] + '_' + cur[1]];
        path.unshift(e.dir);
        cur = e.from;
    }
    return path;
};
PVP.hasEnoughPa = () => {
    return GAME.char_data && GAME.char_data.pr >= PVP.PA_MIN;
};

// ---------------- JEDZENIE RAMENóW ----------------
PVP.senzuByItemId = (itemId) => {
    var senzus = GAME.quick_opts && GAME.quick_opts.senzus;
    if (!senzus) return null;
    return senzus.find((s) => s.item_id === itemId) || null;
};
PVP.lowestRamen = () => {
    for (var i = 0; i < PVP.RAMEN_TIERS.length; i++) {
        var s = PVP.senzuByItemId(PVP.RAMEN_TIERS[i]);
        if (s && parseInt(s.stack) > 0) return s;
    }
    return null;
};
PVP.feedRamenStep = () => {
    if (PVP.stop || !GAME.char_data || GAME.char_data.pr >= PVP.RAMEN_PA_MIN) { PVP.ramen_feeding = false; return; }
    var senzu = PVP.lowestRamen();
    if (!senzu) { PVP.ramen_feeding = false; return; }   // brak ramenów w żadnym tierze
    GAME.socket.emit('ga', { a: 12, type: 8, iid: senzu.id, page: GAME.ekw_page, am: 1 });
    setTimeout(PVP.feedRamenStep, PVP.RAMEN_STEP_GAP);
};
PVP.feedRamens = () => {
    if (PVP.ramen_feeding) return;
    if (!GAME.char_data || GAME.char_data.pr >= PVP.RAMEN_PA_MIN) return;
    if (!PVP.lowestRamen()) return;
    PVP.ramen_feeding = true;
    PVP.feedRamenStep();
};
PVP.patrolTarget = () => {
    if (PVP.patrol_phase == 'walk') return PVP.patrol_route[PVP.patrol_idx];
    if (PVP.patrol_phase == 'return') return PVP.patrol_start;
    return null;
};

PVP.patrol_walk = () => {
    PVP.patrol_walking = true;
    var stop = () => { PVP.patrol_walking = false; };
    if (PVP.stop || !PVP.trasa || PVP.patrol_phase == 'idle' || PVP.patrol_phase == 'done') { stop(); return; }
    if (!GAME.current_loc || GAME.current_loc.id != PVP.patrol_loc) { stop(); return; }
    if (GAME.is_loading) { window.setTimeout(PVP.patrol_walk, 120); return; }
    if (!PVP.hasEnoughPa()) {
        console.log("PVP trasa - PA spadło poniżej " + PVP.PA_MIN + ", przerywam trasę");
        PVP.patrol_phase = 'done';
        stop(); return;
    }

    if (PVP.killing || (!PVP.isHiddenVillage() && PVP.enemiesPresent())) { stop(); return; }
    var t = PVP.patrolTarget();
    if (!t) { PVP.patrol_phase = 'done'; stop(); return; }
    var x = GAME.char_data.x, y = GAME.char_data.y;
    if (x == t.x && y == t.y) {
        PVP.patrol_path = null;
        if (PVP.patrol_phase == 'walk') {
            PVP.patrol_idx++;
            if (PVP.patrol_idx >= PVP.patrol_route.length) {
                PVP.patrol_phase = 'return';
                console.log("PVP trasa - kratki odwiedzone, wracam na " + PVP.patrol_start.x + "|" + PVP.patrol_start.y);
            }
        } else {
            PVP.patrol_phase = 'done';
            console.log("PVP trasa - jestem z powrotem na starcie, trasa zakończona");
            stop(); return;
        }
        window.setTimeout(PVP.patrol_walk, 60);
        return;
    }
    if (!PVP.patrol_path || !PVP.patrol_path.length) {
        PVP.patrol_path = PVP.bfsPath(x, y, t.x, t.y);
        if (!PVP.patrol_path) {
            console.log("PVP trasa - kratka " + t.x + "|" + t.y + " nieosiągalna, pomijam");
            if (PVP.patrol_phase == 'walk') PVP.patrol_idx++;
            else { PVP.patrol_phase = 'done'; stop(); return; }
            window.setTimeout(PVP.patrol_walk, 60);
            return;
        }
    }
    var before = x + '_' + y;
    GAME.map_move(PVP.patrol_path[0]);
    var verify = (tries) => {
        if (GAME.is_loading && tries > 0) { window.setTimeout(() => verify(tries - 1), 150); return; }
        if (GAME.char_data.x + '_' + GAME.char_data.y != before) {
            PVP.patrol_path.shift();
            PVP.patrol_step_fails = 0;
        } else {
            PVP.patrol_step_fails++;
            PVP.patrol_path = null;
            if (PVP.patrol_step_fails > PVP.PATROL_STEP_RETRIES) {
                console.log("PVP trasa - nie mogę dojść do " + t.x + "|" + t.y + ", pomijam kratkę");
                PVP.patrol_step_fails = 0;
                if (PVP.patrol_phase == 'walk') PVP.patrol_idx++;
                else { PVP.patrol_phase = 'done'; stop(); return; }
            }
        }
        window.setTimeout(PVP.patrol_walk, PVP.patrol_step_gap);
    };
    window.setTimeout(() => verify(10), PVP.patrol_verify_wait);
};
PVP.clan_list = () => {
    var list = localStorage.getItem('clan_list');
    if (list === undefined) {
        list = "";
    }
    return list;
};
PVP.save_clan_list = () => {
    localStorage.setItem('clan_list', PVP.war);
};
PVP.waitForOrgHireResult = (warId, attemptsLeft, actingChar) => {
    if (actingChar !== GAME.char_id) { PVP.komBusy = false; return; }
    var failed = false, failedText = '';
    $('#kom_con .kom .content').each(function () {
        var t = $(this).text();
        if (t.indexOf('Nie masz uprawnień') !== -1) { failed = true; failedText = t.trim(); }
    });
    if (failed) {
        console.log("org - najem odrzucony na postaci " + GAME.char_id + " (\"" + failedText + "\"), wyłączam najem na tej postaci do jutra");
        PVP.setCap('org', false);
        delete PVP.cs().orgProgress[warId];
        PVP.komBusy = false;
        return;
    }
    if (attemptsLeft > 0) {
        setTimeout(() => PVP.waitForOrgHireResult(warId, attemptsLeft - 1, actingChar), 300);
    } else {
        PVP.cs().orgProgress[warId] = GAME.getTime();
        if (PVP.getCap('org') === null) PVP.setCap('org', true);
        PVP.komBusy = false;
    }
};
PVP.warsNeedingOrg = () => {
    var out = [];
    if (GAME.emp_wars && GAME.emp_wars.length) {
        var myVillage = GAME.char_data.village_id;
        var matchedOurWar = false;
        for (var i = 0; i < GAME.emp_wars.length; i++) {
            var w = GAME.emp_wars[i];
            var ourOrg;
            if (w.village_1 == myVillage) ourOrg = w.org_1;
            else if (w.village_2 == myVillage) ourOrg = w.org_2;
            else continue;                 // to nie nasza wojna
            matchedOurWar = true;
            if (ourOrg == 0) out.push(w.id);
        }
        if (matchedOurWar) return out;
    }
    var wars = document.getElementsByClassName("war_win");
    for (var j = 0; j < wars.length; j++) {
        var btn = wars[j].getElementsByTagName("button")[0];
        if (btn) {
            var wid = btn.getAttribute("data-war");
            if (wid) out.push(wid);
        }
    }
    return out;
};
PVP.isAtWarWith = (targetId) => {
    var myVillage = GAME.char_data.village_id;
    if (GAME.emp_wars && GAME.emp_wars.length) {
        for (var i = 0; i < GAME.emp_wars.length; i++) {
            var w = GAME.emp_wars[i];
            if ((w.village_1 == myVillage && w.village_2 == targetId) ||
                (w.village_2 == myVillage && w.village_1 == targetId)) {
                return true;
            }
        }
        return false;
    }
    var targetName = LNG['village' + targetId];
    var ownName = LNG['village' + myVillage];
    var found = false;
    $('#emp_wars .war_win').each(function () {
        var names = $(this).find('b');
        var a = $(names[0]).text().trim();
        var b = $(names[1]).text().trim();
        if ((a === ownName && b === targetName) || (a === targetName && b === ownName)) {
            found = true;
        }
    });
    return found;
};

PVP.isWarLord = (charId) => {
    for (var v in PVP.emp_leaders) {
        var ld = PVP.emp_leaders[v];
        if (ld.kage == charId || ld.admiral == charId) return true;
    }
    return false;
};
PVP.hasLeaderData = () => {
    for (var v in PVP.emp_leaders) return true;
    return false;
};
PVP.canDeclareWar = () => {
    var ld = PVP.emp_leaders[GAME.char_data.village_id];
    if (ld) return ld.kage == GAME.char_id || ld.admiral == GAME.char_id;
    var el = document.getElementById('emp_war_delare');
    return !!el && el.style.display !== 'none';
};

PVP.ORG_DEFAULT_ID = 14;
PVP.ORG_STORAGE_KEY = 'swa_pvp_org_id';
PVP.rentable_orgs = null;
PVP.savedOrgId = () => localStorage.getItem(PVP.ORG_STORAGE_KEY) || String(PVP.ORG_DEFAULT_ID);
PVP.renderOrgSelect = () => {
    var $sel = $("#pvp_Panel select[name=org_id]");
    if (!$sel.length || !PVP.rentable_orgs || !PVP.rentable_orgs.length) return;
    var con = '';
    for (var i = 0; i < PVP.rentable_orgs.length; i++) {
        var o = PVP.rentable_orgs[i];
        con += '<option value="' + o.id + '">' + o.short + ' - ' + LNG.lab57 + ': ' + o.cost + ' ' + LNG.lab399 + '</option>';
    }
    $sel.html(con);
    var want = PVP.savedOrgId();
    if ($sel.find('option[value="' + want + '"]').length) $sel.val(want);
    else if ($sel.find('option[value="' + PVP.ORG_DEFAULT_ID + '"]').length) $sel.val(String(PVP.ORG_DEFAULT_ID));
};
if (!window.__SWA_PVP_PARSEDATA_HOOK__) {
    window.__SWA_PVP_PARSEDATA_HOOK__ = true;
    var swaOrigParseData = GAME.parseData;
    GAME.parseData = function (type, res) {
        if (type == 60 && res && typeof PVP !== 'undefined') {
            if (res.edata && res.edata.id && PVP.emp_leaders) {
                PVP.emp_leaders[res.edata.id] = { kage: res.edata.kage, admiral: res.edata.admiral };
            }
            if (res.rentable && res.rentable.length && PVP.renderOrgSelect) {
                PVP.rentable_orgs = res.rentable;
                PVP.renderOrgSelect();
            }
        }
        if (type == 13 && res && res.raps && typeof PVP !== 'undefined' && PVP.onRapsData) {
            PVP.onRapsData(res);
        }
        return swaOrigParseData.apply(this, arguments);
    };
}
PVP.WAR_RESULT_ATTEMPTS = 4;
PVP.checkWarCooldownMsg = (actingChar, preCount, attemptsLeft) => {
    if (actingChar !== GAME.char_id) { PVP.komBusy = false; return; }
    if (attemptsLeft === undefined) attemptsLeft = PVP.WAR_RESULT_ATTEMPTS;

    var $timer = $('#kom_con .kom .content .timer');
    if ($timer.length) {
        var end = parseInt($timer.attr('data-end'));
        var now = GAME.getTime();
        if (end && end > now && end < now + PVP.WAR_COOLDOWN_SANITY_LIMIT) {
            console.log("dec wars - cooldown ustawiony na " + (end - now) + "s (" + Math.round((end - now) / 60) + " min)");
            PVP.cs().warCooldownUntil = end;
        } else if (end) {
            console.log("dec wars - zignorowałem podejrzanie długi cooldown (" + (end - now) + "s)");
        }
        PVP.komBusy = false;
        return;
    }
    if ($('#emp_wars .war_win').length > preCount) { PVP.komBusy = false; return; }
    if (attemptsLeft > 0) {
        setTimeout(() => PVP.checkWarCooldownMsg(actingChar, preCount, attemptsLeft - 1), 350);
    } else {
        PVP.komBusy = false;
    }
};

PVP.nextWarTarget = () => {
    var myVillage = GAME.char_data.village_id;
    var c = PVP.war_cnt;
    for (var i = 0; i < 10; i++) {
        if (c > 10 || c < 1) c = 1;
        if (c != myVillage && !PVP.isAtWarWith(c)) return c;
        c++;
    }
    return null;
};
PVP.RAPS_PENDING_TTL = 15;
PVP.clean_raps = () => {
    if (PVP.raps_check_pending && GAME.getTime() - PVP.raps_check_pending < PVP.RAPS_PENDING_TTL) return;
    if (GAME.getTime() < PVP.raps_next_check) return;
    if (GAME.is_loading) return;
    PVP.raps_next_check = GAME.getTime() + PVP.RAPS_CHECK_INTERVAL;
    PVP.raps_check_pending = GAME.getTime();
    GAME.emitOrder({ a: 11, page: 1, cat: 0 });
};

PVP.onRapsData = (res) => {
    if (!PVP.raps_check_pending) return;
    PVP.raps_check_pending = false;
    var perPage = (res && res.raps) ? res.raps.length : 0;
    if (!perPage || res.all_pages <= 1) return;
    var atLeast = (res.all_pages - 1) * perPage;
    if (atLeast >= PVP.RAPS_LIMIT) {
        console.log("clean raps - raportów co najmniej " + atLeast + " (>= " + PVP.RAPS_LIMIT + "), kasuję wszystkie");
        GAME.emitOrder({ a: 11, type: 5, cat: 0 }, true);  // force: nie może zostać porzucone przez is_loading
    }
};
PVP.speed = () => {
    var list = localStorage.getItem('pvp_speed');
    PVP.WSP = parseInt(list);
    if (list === undefined) {
        list = "";
    }
    return list;
};
PVP.save_speed = () => {
    localStorage.setItem('pvp_speed', PVP.WSP);
};
PVP.WSPP = () => {
    var speed = PVP.WSP;
    if (speed < 10) speed = 2;
    if (speed > 100) speed = 100;
    if ($("#pvp_Panel input[name=speed_capt]").val() == '') speed = 50;
    return speed;
};
GAME.parseListPlayer = function (entry, pvp_master) {
    var res = '';
    if (entry.data) {
        var pd = entry.data;
        if (PVP.higherRebornAvoid && pd.reborn > GAME.char_data.reborn && pd.reborn > 3){return res;}
        var qb = '';
        var klan = '', erank = '';
        if (pd.klan_id) {
            var clanCls = '';
            if (this.clan_enemies.indexOf(pd.klan_id) != -1) clanCls = 'enemy';
            klan = '<b class="poption player_clan ' + clanCls + '" data-option="show_clan" data-klan_id="' + pd.klan_id + '">' + pd.klan_short + ' <img src="' + pd.emblem + '" /></b>';
        }
        var cls = '';
        if (entry.cd) {
            qb += this.showTimer(entry.cd - this.getTime(), 'data-special="10" data-pd="' + pd.id + '"', ' playercd' + pd.id + '');
            cls = 'initial_hide_forced playericons' + pd.id;
        }
        if (pd.empire) {
            var cls2 = '';
            if (this.emp_enemies.indexOf(pd.empire) != -1) {
                if (this.emp_enemies_t[pd.empire] == 1) cls2 = 'war';
                else if (this.empire_locations.indexOf(this.char_data.loc) != -1) cls2 = 'war';
            }
            if (!pd.glory_rank) pd.glory_rank = 1;
            erank = '<img src="/gfx/empire/ranks/' + pd.empire + '/' + pd.glory_rank + '.png" class="glory_rank ' + cls2 + '" />';
        }
        qb += '<button class="poption map_bicon ' + cls + '" data-option="pvp_attack" data-char_id="' + pd.id + '"><i class="ca"></i></button>';
        if (pvp_master) qb += '<button class="poption map_bicon ' + cls + '" data-option="pvp_attack" data-char_id="' + pd.id + '" data-quick="1"><i class="qa"></i></button>';
        res += '<div class="player"><div class="belka">' + erank + '<strong class="player_rank' + pd.ranga + ' poption" data-option="show_player" data-char_id="' + pd.id + '">' + pd.name + '</strong> <span>' + this.rebPref(pd.reborn) + pd.level + '</span> ' + klan + '</div><div id="pvp_opts_' + pd.id + '" class="right_btns">' + qb + '</div></div>';
    }
    else if (entry.more) {
        res += '<div class="more_players"><button class="poption" data-option="load_more_players" data-start_from="' + entry.next_from + '">+' + entry.more + '</button></div>';
    }
    return res;
};
GAME.parsePlayerShadow = function (data, pvp_master) {
    var entry = data.data;
    var res = '';
    if (entry.data) {
        var pd = entry.data;
        if ( PVP.higherRebornAvoid && pd.reborn > GAME.char_data.reborn && pd.reborn > 3){return res;}
        pd.empire = entry.empire;
        var qb = '';
        var erank = '';
        var cls = '';
        if (data.cd) {
            qb += this.showTimer(data.cd - this.getTime(), 'data-special="10" data-pd="' + pd.id + '"', ' playercd' + pd.id + '');
            cls = 'initial_hide_forced playericons' + pd.id;
        }
        if (pd.empire) {
            var cls2 = '';
            if (this.emp_enemies.indexOf(pd.empire) != -1) {
                if (this.emp_enemies_t[pd.empire] == 1) cls2 = 'war';
                else if (this.empire_locations.indexOf(this.char_data.loc) != -1) cls2 = 'war';
            }
            if (!pd.glory_rank) pd.glory_rank = 1;
            erank = '<img src="/gfx/empire/ranks/' + pd.empire + '/' + pd.glory_rank + '.png" class="glory_rank ' + cls2 + '" />';
        }
        qb += '<button class="poption map_bicon ' + cls + '" data-option="gpvp_attack" data-char_id="' + pd.id + '"><i class="ca"></i></button>';
        if (pvp_master) qb += '<button class="poption map_bicon ' + cls + '" data-option="gpvp_attack" data-char_id="' + pd.id + '" data-quick="1"><i class="qa"></i></button>';
        res += '<div class="player"><div class="belka">' + erank + '<strong class="player_rank' + pd.ranga + ' poption" data-option="show_player" data-char_id="' + pd.id + '">' + pd.name + ' - ' + LNG.lab348 + '</strong> <span>' + this.rebPref(pd.reborn) + pd.level + '</span> </div><div id="gpvp_opts_' + pd.id + '" class="right_btns">' + qb + '</div></div>';
    }
    else if (entry.more) {
        res += '<div class="more_players"><button class="poption" data-option="load_more_players" data-start_from="' + entry.next_from + '">+' + entry.more + '</button></div>';
    }
    return res;
};
}
