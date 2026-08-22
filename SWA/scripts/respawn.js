
(function () {
if (window.__SWA_RESPAWN_ENGINE_RUNNING__) return;
window.__SWA_RESPAWN_ENGINE_RUNNING__ = true;

var wait_resp = 2; //szybkość skryptu 1-1000 im mniejsza wartość tym szybciej
var useBlueBeans = false; // czy ma być użyta niebieska fasolka
var useRedBeans = true; // czy ma być użyta czerwona fasolka
var limitPA = 1400 // ilość PA przy której używana jest fasolka
var stopIfAnotherPlayerOn = true;
var stop_resp = false; //zatrzyamnie skryptu
var killLegend = true; //zbijanie legend
var killEpic = true; // zbijanie epic
var killMystic = true; //zbijanie mistic
var killAuto = true; // zbijanie autowalka
var moveCount = 0;
var moveCountTarget = 13;

//---------------------------------------------------------------------------------------------------------
var downb = false;
var whatNow = 0;

var antybotPath = false; // pozostałe kroki do rozwiązania zagadki antybotowej
var savedPos = false; // kratka, na której skrypt został zatrzymany przez zagadkę
var returning = false; // czy skrypt wraca na zapisaną kratkę po rozwiązaniu zagadki
var returnMoveWait = 300; // ms - odstęp między krokami powrotu, żeby serwer zdążył zaktualizować pozycję
var returnMoveNextAt = 0; // kiedy wolno wysłać kolejny krok powrotu
//---------------------WYGLAD----------------------------------

// ===================================
function check (x, y, path, p, tX, tY) {
    x = parseInt(x)
    y = parseInt(y)
    tX = parseInt(tX)
    tY = parseInt(tY)

    const cP = `${x}_${y}` // current position

    const p1 = `${x - 1}_${y - 1}`
    const d1 = !path.includes(p1) && p[p1]

    const p2 = `${x}_${y - 1}`
    const d2 = !path.includes(p2) && p[p2]

    const p3 = `${x + 1}_${y - 1}`
    const d3 = !path.includes(p3) && p[p3]

    const p4 = `${x - 1}_${y}`
    const d4 = !path.includes(p4) && p[p4]

    const p5 = `${x + 1}_${y}`
    const d5 = !path.includes(p5) && p[p5]

    const p6 = `${x - 1}_${y + 1}`
    const d6 = !path.includes(p6) && p[p6]

    const p7 = `${x}_${y + 1}`
    const d7 = !path.includes(p7) && p[p7]

    const p8 = `${x + 1}_${y + 1}`
    const d8 = !path.includes(p8) && p[p8]

    // found player position path
    if (x === tX && y === tY) return [...path, cP]

    let r = false

    if (d1 === 1) {
        r = check(x - 1, y - 1, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d2 === 1) {
        r = check(x, y - 1, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d3 === 1) {
        r = check(x + 1, y - 1, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d4 === 1) {
        r = check(x - 1, y, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d5 === 1) {
        r = check(x + 1, y, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d6 === 1) {
        r = check(x - 1, y + 1, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d7 === 1) {
        r = check(x, y + 1, [...path, cP], p, tX, tY)
        if (r) return r
    }

    if (d8 === 1) {
        r = check(x + 1, y + 1, [...path, cP], p, tX, tY)
        if (r) return r
    }

    return false
}

/**
 * Returns move direction. Same as used by game.
 *
 * 	6	2	5
 * 	8		7
 * 	4	1	3
 */
function getDir(x, y, nx, ny) {
    x = parseInt(x)
    y = parseInt(y)
    nx = parseInt(nx)
    ny = parseInt(ny)
    if (x > nx && y > ny) return 6
    if (x === nx && y > ny) return 2
    if (x < nx && y > ny) return 5
    if (x > nx && y === ny) return 8
    if (x < nx && y === ny) return 7
    if (x > nx && y < ny) return 4
    if (x === nx && y < ny) return 1
    if (x < nx && y < ny) return 3
}

// converts array with positions to directions array
function getMoves (result) {
    return result
        .map((item, index, arr) => {
            if (!arr[index + 1]) return
            const [x, y] = item.split('_')
            const [nx, ny] = arr[index + 1].split('_')
            return getDir(x, y, nx, ny)
        })
        .filter(item => item)
}

// returns position of target cell
function getFinalPosition(premiumData) {
    return Object.keys(premiumData)
        .filter(key => premiumData[key] === 2)[0]
        .split('_')
}

function cellWalkable(x, y) {
    var c = GAME.mapcell && GAME.mapcell[x + '_' + y];
    return !!c && c.m != 0;
}

function bfsPath(sx, sy, tx, ty) {
    sx = parseInt(sx); sy = parseInt(sy); tx = parseInt(tx); ty = parseInt(ty);
    if (!cellWalkable(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    var maxx = parseInt(GAME.current_loc.x_max), maxy = parseInt(GAME.current_loc.y_max);
    var prev = {}, queue = [[sx, sy]];
    prev[sx + '_' + sy] = true;
    var dirs = [[0, 1, 1], [0, -1, 2], [1, 0, 7], [-1, 0, 8]]; // dol, gora, prawo, lewo
    while (queue.length) {
        var c = queue.shift();
        if (c[0] === tx && c[1] === ty) break;
        for (var i = 0; i < 4; i++) {
            var nx = c[0] + dirs[i][0], ny = c[1] + dirs[i][1];
            if (nx < 1 || ny < 1 || nx > maxx || ny > maxy) continue;
            var k = nx + '_' + ny;
            if (prev[k] || !cellWalkable(nx, ny)) continue;
            prev[k] = { from: c, dir: dirs[i][2] };
            queue.push([nx, ny]);
        }
    }
    var e = prev[tx + '_' + ty];
    if (!e || e === true) return null;
    var path = [], cur = [tx, ty];
    while (!(cur[0] === sx && cur[1] === sy)) {
        e = prev[cur[0] + '_' + cur[1]];
        path.unshift(e.dir);
        cur = e.from;
    }
    return path;
}

function start(){


var delay = wait_resp;

if(GAME.is_loading){
delay = 16; // czekamy na ack serwera po ruchu - sprawdzamy co ~1 klatke, zeby kolejny krok szedl od razu
}else if(checkAntyBot()){
solveAntybot();
}else if(returning){
returnToSavedPos();
}else if(respIsRed()){
delay = 200; // cooldown respa - tu tylko fallback; realne wybudzenie robi MutationObserver ponizej
}else{
action();
}
schedule(delay);
}

var _respTimer = null;
function schedule(delay){
	if(_respTimer) clearTimeout(_respTimer);
	_respTimer = window.setTimeout(start, delay);
}

// Reaguj DOKLADNIE w chwili, gdy resp zmienia sie z czerwonego na zielony (zero opoznienia)
var _wasRed = false;
function setupRespObserver(){
	var el = document.querySelector('.resp_resp1 .resp_status');
	if(!el){ window.setTimeout(setupRespObserver, 200); return; } // panel jeszcze nie wczytany
	_respStatusEl = el;
	_wasRed = el.classList.contains('red');
	var obs = new MutationObserver(function(){
		var red = el.classList.contains('red');
		if(_wasRed && !red){
			if(_respTimer) clearTimeout(_respTimer);
			start(); // resp gotowy - uderz natychmiast, nie czekaj na timer
		}
		_wasRed = red;
	});
	obs.observe(el, {attributes: true, attributeFilter: ['class']});
}

function solveAntybot(){
if(!savedPos) savedPos = {x: GAME.char_data.x, y: GAME.char_data.y};

var x = GAME.char_data.x;
var y = GAME.char_data.y;

var premiumData = Object.assign({}, GAME.premiumData);
premiumData[x + '_' + y] = 1;

var finalPos = getFinalPosition(premiumData);
var tX = finalPos[0];
var tY = finalPos[1];

if(!antybotPath){
var p = Object.assign({}, premiumData);
p[tX + '_' + tY] = 1;
var result = check(x, y, [], p, tX, tY);
var moves = result && getMoves(result);
antybotPath = moves || [];
}

var dir = antybotPath.shift();
if(dir){
GAME.emitOrder({a:4, dir: dir, vo:GAME.map_options.vo});
}else{
antybotPath = false;
returning = true;
}
}

function returnToSavedPos(){
if(!savedPos){
returning = false;
return;
}

var x = GAME.char_data.x;
var y = GAME.char_data.y;

if(x === savedPos.x && y === savedPos.y){
savedPos = false;
returning = false;
returnMoveNextAt = 0;
return;
}

if(Date.now() < returnMoveNextAt) return;
returnMoveNextAt = Date.now() + returnMoveWait;

var path = (GAME.current_loc && GAME.mapcell) ? bfsPath(x, y, savedPos.x, savedPos.y) : null;
var dir = (path && path.length) ? path[0] : getDir(x, y, savedPos.x, savedPos.y); // fallback: linia prosta
GAME.emitOrder({a:4, dir: dir, vo:GAME.map_options.vo});
}

function action(){
	if (respIsRed())
		return;
switch (whatNow) {
case 0:
whatNow++;
go();
break;
case 1:
moveCount++;
if(moveCount >= moveCountTarget){
whatNow++;
moveCount = 0;
}else{
whatNow = 0;
}
if(killMystic)
kill_mystic();
break;
case 2:
whatNow++;
if(killAuto)
kill_auto();
break;
case 3:
whatNow++;
break;
case 4:
whatNow++;
if(killLegend)
kill_legend();
break;
case 5:
whatNow++;
if(killEpic)
kill_epic();
break;
case 6:
whatNow=0;
if(stopIfAnotherPlayerOn)
stopIfAnotherPlayer();
break;
default:

}
}

var _respStatusEl = null;
function respIsRed(){
	if (!_respStatusEl || !_respStatusEl.isConnected) {
		_respStatusEl = document.querySelector('.resp_resp1 .resp_status');
	}
	return !!_respStatusEl && _respStatusEl.classList.contains('red');
}

var _fightCleanupScheduled = false;
function hideAndRemoveFightPanels(){
	var ids = ['fight_con', 'fight_t1', 'fight_t0'];
	for (var i = 0; i < ids.length; i++) {
		var el = document.getElementById(ids[i]);
		if (el) el.style.display = 'none';
	}
	if (_fightCleanupScheduled) return;
	_fightCleanupScheduled = true;
	window.setTimeout(function(){
		_fightCleanupScheduled = false;
		for (var j = 0; j < ids.length; j++) {
			var e = document.getElementById(ids[j]);
			if (e) e.remove();
		}
	}, 100);
}

function checkAntyBot(){
if(GAME.premiumData === undefined || GAME.premiumData === null){
return false;
}else{
return true;
}

}
function go(){
if(GAME.char_data.pr < limitPA && (useBlueBeans || useRedBeans)){
stop_resp==true;
}
if(downb){
go_down();
}else {
go_up();
}
}
function go_down(){
GAME.map_move(3);
downb = false;

}
function go_up(){
GAME.map_move(6);
downb = true;
}
function kill_auto(){
if (!GAME.field_mobs) return;
var mobId = -1;
for (var i = 0; i < GAME.field_mobs.length; i++) {
var m = GAME.field_mobs[i];
if (m && m.ranks && m.ranks[0]) { mobId = i; break; } // normalny mob nie musi być w slocie 0
}
if (mobId < 0) return;
if (GAME.field_mf && GAME.field_mf[mobId] >= 0) GAME.emitOrder({a:13,mob_num:mobId,fo:GAME.map_options.ma}); // multi fight unlocked
else GAME.emitOrder({a:7,mob_num:mobId,rank:0,quick:1}); // normal fight until multi fight unlocks
}
function kill_mystic() {
var el = document.querySelector('[data-mob-rank="1"]');
if (!el) return; // brak mistyka - nie ruszamy DOM ani nie planujemy czyszczenia paneli
el.click();
hideAndRemoveFightPanels();
}
function kill_legend() {
//GAME.emitOrder({a:7,mob_num:0,rank:2,quick:1});
$('[data-mob-rank="2"]').click();
hideAndRemoveFightPanels();
}
function kill_epic() {

$('[data-mob-rank="3"]').click();
hideAndRemoveFightPanels();
}

function stopIfAnotherPlayer(){
if(stopIfAnotherPlayerOn){
//if(Object.keys(GAME.map_players).length <= 2 && GAME.map_players[1499].y >=39){//Sprawdzanie czy na planszy sa inni gracze
if(Object.keys(GAME.map_players).length <= 0){
return true;
}else{
return false;
}
}else{
scriptOn();
return true;
}
}
function scriptOn(){
stop_resp = false;
}
setupRespObserver();
start();
})();


