(function () {
if (window.__SWA_EXP_ENGINE_RUNNING__) return;
window.__SWA_EXP_ENGINE_RUNNING__ = true;

let wait2_exp = 2


let cachedSub = 'x4'
let cachedRanks = [true, true, true, true]

function refreshConf() {
    const v = localStorage.getItem('swa_sub_label')
    cachedSub = v === null ? 'x4' : v
    try {
        const r = JSON.parse(localStorage.getItem('swa_exp_ranks'))
        cachedRanks = Array.isArray(r) ? r : [true, true, true, true]
    } catch (e) {
        cachedRanks = [true, true, true, true]
    }
}
refreshConf()

function getConfSub() {
    return cachedSub
}

const $doubler_bar = document.getElementById('doubler_bar')

let antybotPath = false
let stop_exp = true
let moveTimeout
let redResumeTimer = null   // timer wznawiajacy po cooldownie rare respa (kasowany przez observer)
let expWasRed = false

// stan trawersowania mapy (pełne pokrycie po layoucie z GAME.mapcell)
let visited = {}        // kratki odwiedzone w bieżącym okrążeniu
let blocked = {}        // kratki, na które serwer nie pozwolił wejść (czyszczone co okrążenie)
let mapPath = null      // lista kierunków do najbliższej nieodwiedzonej kratki
let routeLoc = null     // id lokacji, dla której zbudowano visited/blocked
let pendingStep = null  // {x, y} kratka, na którą właśnie próbujemy wejść

const DIRS = [
    [0, 1, 1],   // dół
    [0, -1, 2],  // góra
    [1, 0, 7],   // prawo
    [-1, 0, 8],  // lewo
    [1, 1, 3],   // prawy-dół
    [-1, 1, 4],  // lewy-dół
    [1, -1, 5],  // prawy-góra
    [-1, -1, 6], // lewy-góra
]

/**
 * BFS po 8 kierunkach - najkrótsza (w liczbie ruchów) ścieżka od (sx, sy)
 * do najbliższej kratki spełniającej isTarget. Obsługuje dowolny kształt mapy
 * i przeszkody, bo chodzi wyłącznie po kratkach dopuszczonych przez isWalkable.
 *
 * @param {Number} sx - startowy X
 * @param {Number} sy - startowy Y
 * @param {Function} isWalkable - (x, y) => czy można wejść na kratkę
 * @param {Function} isTarget - (x, y) => czy kratka jest celem
 * @returns {Array|null} - lista kierunków (jak w GAME.map_move) albo null, gdy cel nieosiągalny
 */
function bfs (sx, sy, isWalkable, isTarget) {
    if (isTarget(sx, sy)) return []

    const prev = { [`${sx}_${sy}`]: true }
    let queue = [[sx, sy]]

    while (queue.length) {
        const nextQueue = []
        for (let q = 0; q < queue.length; q++) {
            const [cx, cy] = queue[q]
            for (let i = 0; i < DIRS.length; i++) {
                const nx = cx + DIRS[i][0]
                const ny = cy + DIRS[i][1]
                const key = `${nx}_${ny}`
                if (prev[key] || !isWalkable(nx, ny)) continue
                prev[key] = { fx: cx, fy: cy, dir: DIRS[i][2] }

                if (isTarget(nx, ny)) {
                    const path = []
                    let k = key
                    while (prev[k] !== true) {
                        path.unshift(prev[k].dir)
                        k = `${prev[k].fx}_${prev[k].fy}`
                    }
                    return path
                }
                nextQueue.push([nx, ny])
            }
        }
        queue = nextQueue
    }
    return null
}

/**
 * Returns position with target cell
 *
 * @returns {Array}
 */
function getFinalPosition(premiumData) {
    return Object.keys(premiumData)
        .filter(key => premiumData[key] === 2)[0]
        .split('_')
        .map(Number)
}
// -----------------------------------

function mapWalkable (x, y) {
    if (blocked[`${x}_${y}`]) return false
    const c = GAME.mapcell && GAME.mapcell[`${x}_${y}`]
    return !!c && c.m != 0
}

function resetRoute () {
    visited = {}
    blocked = {}
    mapPath = null
    pendingStep = null
    routeLoc = GAME.current_loc ? GAME.current_loc.id : null
}

function emitStep (dir) {
    const d = DIRS.find(item => item[2] === dir)
    pendingStep = d ? { x: GAME.char_data.x + d[0], y: GAME.char_data.y + d[1] } : null
    GAME.emitOrder({a: 4, dir: dir, vo: GAME.map_options.vo})
}

function stepRejected () {
    if (pendingStep) {
        blocked[`${pendingStep.x}_${pendingStep.y}`] = true
        pendingStep = null
    }
    antybotPath = false
    mapPath = null
}

function isAntybotActive () {
    return !!GAME.premiumData
}

function getEnabledRanks () {
    return cachedRanks
}

function fight (mob_num = 0) {
    if (stop_exp) return

    const ranks = getEnabledRanks()
    const mob = GAME.field_mobs[mob_num]

    if (ranks[1] && mob.ranks[1] && GAME.mf[mob.mob_id] !== 3) fightLegend(mob_num) // kill champion if exists
    else if (ranks[2] && mob.ranks[2]) fightEpic(mob_num) // kill elite if exists
    else if (ranks[3] && mob.ranks[3]) fightMystic(mob_num) // kill boss if exists
    else if (ranks[0] && mob.ranks[0] && GAME.field_mf && GAME.field_mf[mob_num] >= 0) GAME.emitOrder({a: 13, mob_num: mob_num, fo: ranks}) // multi fight unlocked
    else if (ranks[0] && mob.ranks[0]) GAME.emitOrder({a: 7, mob_num: mob_num, rank: 0, quick: 1}) // normal fight until multi fight unlocks
}

function fightLegend (mob_num = 0) {
    GAME.emitOrder({a: 7, mob_num: mob_num, rank: 1, quick: 1});
}

function fightEpic (mob_num = 0) {
    GAME.emitOrder({a: 7, mob_num: mob_num, rank: 2, quick: 1});
}

function fightMystic (mob_num = 0) {
    GAME.emitOrder({a: 7, mob_num: mob_num, rank: 3, quick: 1});
}

function areMobsOnField() {
    const ranks = getEnabledRanks()
    const mob_index = GAME.field_mobs.findIndex(field_mob => {
        return field_mob.ranks.some((rank, index) => {
            return ranks[index] && rank > 0
        })
    })

    if (mob_index === -1) return false
    else return { mob_num: mob_index }
}

// ===================================
// SUBSTANCE
function useSub () {
    const confSub = getConfSub()
    if (!confSub) return

    const subs = GAME.quick_opts.sub || []
    const chosen = subs.find(s => (s[GAME.lang] || '').includes(confSub))

    if (!chosen) return

    GAME.emitOrder({
        a: 12,
        type: 8,
        sel: 0,
        iid: chosen.id
    })
}

function move () {
    if (($(".resp_rare .resp_status").hasClass("red"))) {
        stop_exp = true;
        if (redResumeTimer) clearTimeout(redResumeTimer);
        redResumeTimer = window.setTimeout(move, 300); // fallback; realne wznowienie robi observer
        return;
    } else {
        stop_exp = false;
        if (redResumeTimer) { clearTimeout(redResumeTimer); redResumeTimer = null; }
    }
    if (moveTimeout) clearTimeout(moveTimeout)
    moveTimeout = setTimeout(move, 700) // trigger move after 700 ms without move action

    const x = GAME.char_data.x
    const y = GAME.char_data.y

    if (isAntybotActive()) {
        const premiumData = GAME.premiumData
        const [tX, tY] = getFinalPosition(premiumData)

        if (!antybotPath) {
            const walkable = (nx, ny) => premiumData[`${nx}_${ny}`] === 1 || (nx === tX && ny === tY)
            antybotPath = bfs(x, y, walkable, (nx, ny) => nx === tX && ny === tY)
        }

        const dir = antybotPath && antybotPath.shift()
        if (dir) {
            emitStep(dir)
        } else {
            antybotPath = false
        }

        return
    }

    if (!GAME.mapcell || !GAME.current_loc) {
        GAME.loadMapJson(function () {
            GAME.socket.emit('ga', {
                a: 3,
                vo: GAME.map_options.vo
            }, 1);
        })
        return
    }

    if (routeLoc !== GAME.current_loc.id) resetRoute()

    visited[`${x}_${y}`] = true

    if (!mapPath || !mapPath.length) {
        const toUnvisited = (nx, ny) => !visited[`${nx}_${ny}`] && mapWalkable(nx, ny)
        mapPath = bfs(x, y, mapWalkable, toUnvisited)

        if (!mapPath || !mapPath.length) {
            visited = { [`${x}_${y}`]: true }
            blocked = {}
            mapPath = bfs(x, y, mapWalkable, toUnvisited)
        }
    }

    const dir = mapPath && mapPath.shift()
    if (dir) emitStep(dir)
}

// ===================================
// RESPONSE HANDLING
function moveOrFight () {
    const mobs = areMobsOnField()
    if (mobs) {
        fight(mobs.mob_num)
        return
    }
    move()
}

function handleResponse (res) {
    // on move response
    if (res.a === 4 && res.char_id === GAME.char_id) setTimeout(moveOrFight, wait2_exp);

    // on fight response (single attack or multi attack)
    else if (res.a === 7 || res.a === 13) setTimeout(moveOrFight, wait2_exp);

    // on speed potion use response
    else if (res.a === 12 && res.type === 8) move()

    // on SSJ use response
    else if (res.a === 18 && res.ssj) move()

    // on collect CSK use response
    else if (res.a === 21) {
        move()
    }

    // on empty response (e.g. when player can't move)
    else if (res.a === undefined) setTimeout(() => {
        stepRejected()
        move()
    }, 50);
}

GAME.socket.on('gr', handleResponse);

function subStep () {
    refreshConf() // odswiezenie cache konfiguracji raz na sekunde
    const expOn = !$(".resp_rare .resp_status").hasClass("red")
    const confSub = getConfSub()
    const barHidden = $doubler_bar && $doubler_bar.style.display === 'none'
    const expired = GAME.doubler_end * 1000 < new Date().getTime()
    if (expOn && confSub && (barHidden || expired)) {
        useSub()
    }
    setTimeout(subStep, 1000)
}
subStep()

// Wznow exp DOKLADNIE w chwili, gdy rare resp zmienia sie z czerwonego na zielony (zamiast czekac do 300 ms)
function setupExpRareObserver () {
    const el = document.querySelector('.resp_rare .resp_status')
    if (!el) { window.setTimeout(setupExpRareObserver, 200); return } // panel jeszcze nie wczytany
    expWasRed = el.classList.contains('red')
    new MutationObserver(() => {
        const red = el.classList.contains('red')
        if (expWasRed && !red) {
            if (redResumeTimer) { clearTimeout(redResumeTimer); redResumeTimer = null }
            move() // cooldown zszedl - rusz od razu, nie czekaj na timer
        }
        expWasRed = red
    }).observe(el, { attributes: true, attributeFilter: ['class'] })
}
setupExpRareObserver()

move()
})();
