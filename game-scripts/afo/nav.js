// Poruszanie się kliknięciem na mapę: klik w kratkę -> BFS -> marsz krok po kroku.
if (typeof GAME !== 'undefined') {

var NAV = window.NAV = window.NAV || {};

NAV.walking = false;
NAV.path = null;            // pozostałe kierunki (jak w GAME.map_move) do celu
NAV.target = null;          // {x, y} klikniętej kratki
NAV.token = 0;              // rośnie przy każdym nowym celu - unieważnia poprzedni marsz
NAV.fails = 0;              // nieudane kroki z rzędu
NAV.STEP_VERIFY_WAIT = 40;  // ms: odczekanie po kroku zanim sprawdzimy, czy pozycja się zmieniła
NAV.STEP_GAP = 20;          // ms: przerwa przed kolejnym krokiem
NAV.STEP_RETRIES = 6;       // nieudane kroki z rzędu, po których rezygnujemy z celu

NAV.cellWalkable = function (x, y) {
    var c = GAME.mapcell && GAME.mapcell[x + '_' + y];
    return !!c && c.m != 0;
};

NAV.bfsPath = function (sx, sy, tx, ty) {
    if (!GAME.current_loc || !GAME.mapcell) return null;
    if (!NAV.cellWalkable(tx, ty)) return null;
    if (sx == tx && sy == ty) return [];
    var maxx = GAME.current_loc.x_max, maxy = GAME.current_loc.y_max;
    // [dx, dy, dir] - dir zgodny z GAME.map_move (1 dol, 2 gora, 7 prawo, 8 lewo, 3-6 skosy)
    var dirs = [
        [0, 1, 1], [0, -1, 2], [1, 0, 7], [-1, 0, 8],
        [1, 1, 3], [-1, 1, 4], [1, -1, 5], [-1, -1, 6]
    ];
    var prev = {}, queue = [[sx, sy]], head = 0;
    prev[sx + '_' + sy] = true;
    while (head < queue.length) {
        var c = queue[head++];
        if (c[0] == tx && c[1] == ty) break;
        for (var i = 0; i < dirs.length; i++) {
            var nx = c[0] + dirs[i][0], ny = c[1] + dirs[i][1];
            if (nx < 1 || ny < 1 || nx > maxx || ny > maxy) continue;
            var k = nx + '_' + ny;
            if (prev[k] || !NAV.cellWalkable(nx, ny)) continue;
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

NAV.tileFromEvent = function (evt) {
    var canvas = (GAME.map && GAME.map.canvas) || document.getElementById('map_canvas');
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // przelicz z pikseli CSS na piksele świata (rozdzielczość canvasu = układ rysowania)
    var px = (evt.clientX - rect.left) * (canvas.width / rect.width) + GAME.map.cam_x;
    var py = (evt.clientY - rect.top) * (canvas.height / rect.height) + GAME.map.cam_y;
    return { x: Math.floor(px / GAME.map.fX) + 1, y: Math.floor(py / GAME.map.fY) + 1 };
};

NAV.goTo = function (tx, ty) {
    if (!GAME.char_data || !GAME.current_loc || !GAME.mapcell) return;
    if (tx < 1 || ty < 1 || tx > GAME.current_loc.x_max || ty > GAME.current_loc.y_max) return;
    if (!NAV.cellWalkable(tx, ty)) { if (GAME.komunikat) GAME.komunikat('Tam nie da się wejść'); return; }
    var path = NAV.bfsPath(GAME.char_data.x, GAME.char_data.y, tx, ty);
    if (!path) { if (GAME.komunikat) GAME.komunikat('Brak drogi do celu'); return; }
    NAV.target = { x: tx, y: ty };
    NAV.path = path;
    NAV.fails = 0;
    NAV.token++;
    if (!NAV.walking) NAV.step(NAV.token);
};

NAV.stop = function () {
    NAV.token++;            // unieważnia bieżący marsz
    NAV.walking = false;
    NAV.path = null;
    NAV.target = null;
};

NAV.step = function (token) {
    if (token !== NAV.token) { NAV.walking = false; return; }
    NAV.walking = true;
    if (!NAV.target || !GAME.char_data || !GAME.current_loc || !GAME.mapcell) { NAV.walking = false; return; }
    if (GAME.is_loading) { window.setTimeout(function () { NAV.step(token); }, 120); return; }

    var x = GAME.char_data.x, y = GAME.char_data.y;
    if (x == NAV.target.x && y == NAV.target.y) { NAV.stop(); return; }

    if (!NAV.path || !NAV.path.length) {
        NAV.path = NAV.bfsPath(x, y, NAV.target.x, NAV.target.y);
        if (!NAV.path || !NAV.path.length) { NAV.stop(); return; }
    }

    var before = x + '_' + y;
    GAME.map_move(NAV.path[0]);

    var verify = function (tries) {
        if (token !== NAV.token) { NAV.walking = false; return; }
        if (GAME.is_loading && tries > 0) { window.setTimeout(function () { verify(tries - 1); }, 150); return; }
        if (GAME.char_data.x + '_' + GAME.char_data.y != before) {
            NAV.path.shift();
            NAV.fails = 0;
        } else {
            NAV.fails++;
            NAV.path = null;   // przelicz trasę od aktualnej pozycji (mapa mogła się zmienić / cel zablokowany)
            if (NAV.fails > NAV.STEP_RETRIES) {
                console.info('[AFO] NAV - nie mogę dojść do ' + NAV.target.x + '|' + NAV.target.y + ', przerywam');
                NAV.stop();
                return;
            }
        }
        window.setTimeout(function () { NAV.step(token); }, NAV.STEP_GAP);
    };
    window.setTimeout(function () { verify(10); }, NAV.STEP_VERIFY_WAIT);
};

NAV.onClick = function (evt) {
    if (evt.button !== 0) return;      // tylko lewy przycisk
    if (!GAME.maploaded) return;
    var t = NAV.tileFromEvent(evt);
    if (t) NAV.goTo(t.x, t.y);
};

NAV.attach = function () {
    var canvas = (GAME.map && GAME.map.canvas) || document.getElementById('map_canvas');
    if (!canvas) { window.setTimeout(NAV.attach, 500); return; }
    if (canvas.__nav_click_bound__) return;
    canvas.__nav_click_bound__ = true;
    canvas.addEventListener('click', NAV.onClick, false);
    console.info('[AFO] NAV - klik na mapę = ruch gotowe');
};

NAV.attach();
}
