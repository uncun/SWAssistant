function kill(){

//Konfiguracja
var wait = 2; //szybkość skryptu 1-1000 im mniejsza wartość tym szybciej
var maxDown = 0; // ustawić 0 jeśli nie używane, maksymalna wartość na mapie do której ma się poruszać postać w dół
var maxUp = 0; // ustawić 0 jeśli nie używane, maksymalna wartość na mapie do której ma się poruszać postać w górę
var maxLeft = 0; // ustawić 0 jeśli nie używane, maksymalna wartość na mapie do której ma się poruszać postać w lewo
var useBlueBeans = false; // czy ma być użyta niebieska fasolka
var useRedBeans = true; // czy ma być użyta czerwona fasolka
var useBattery =  false; // czy ma być użyta bateria 1mln PA
var quantityBlue = 8300; //ile ma być użytych niebieskich fasolek
var collectBlueSenzuOn = false; //zatrzyamnie skryptu po zebraniu maksymalnej ilości niebieskich fasolek
var limitPA = 800 // ilość PA przy której używana jest fasolka
var stopIfAnotherPlayerOn = true;
var stop = false; //zatrzyamnie skryptu
var killLegend = true; //zbijanie legend
var killEpic = true; // zbijanie epic
var killMystic = true; //zbijanie mistic
var killAuto = true; // zbijanie autowalka
var collectDB = true; // skrypt do zbierania czarnych kul
var buttonArray = $( "button[data-option='arena_attack']");
var arenaPlayerIndex = 1;
var waitArena = 80;
//---------------------------------------------------------------------------------------------------------
var minX = 1;
var minY = 1;
var mapay = Math.sqrt(Object.keys(GAME.mapcell).length);
var leftb = true;
var rightb = false;
var upb = false;
var downb = false;
var whatNow = 0;
var arena_courent = 0;
var max_Senzu = Math.floor(GAME.char_data.pr_max/100*2*(1+GAME.getStat(99)/100));
var refresh_arena = 0;

while(GAME.mapcell[minX+'_'+Math.floor(mapay/2)].m==0){
minX++;
}
while(GAME.mapcell[minX+'_'+minY].m==0){
minY++;
}
while(GAME.mapcell[minX+'_'+mapay].m==0){
mapay--;
}

 

function start(){
if(!GAME.is_loading && !stop && collectBlueSenzu() && !checkAntyBot() ){
action();
window.setTimeout(start,wait);
}else {
window.setTimeout(start,wait);
}
}

function action(){
if ($(".resp_rare .resp_status").hasClass("red"))
    return;
switch (whatNow) {
case 0:
whatNow++;
go();
break;
case 1:
whatNow=0;
if(killAuto)
kill_auto();
break;
case 2:
whatNow++;
if(killMystic)
kill_mystic();
break;
case 3:
whatNow++;
if(collectDB)
click_db();
break;
case 4:
whatNow++;
if(killLegend)
kill_legend();
break;
case 5:
whatNow=0;
if(killEpic)
kill_epic();
break;
case 6:
whatNow=0;
// if(stopIfAnotherPlayerOn)
// stopIfAnotherPlayer();
break;
case 7:
whatNow++;
// killArena();
break;
case 8:
whatNow=0;
// soulFight();
break;
default:

}
}
function checkAntyBot(){
if(GAME.premiumData === undefined || GAME.premiumData === null){
return false;
}else{
return true;
}

}
function go(){
if(GAME.char_data.pr < limitPA && (useBlueBeans || useRedBeans || useBattery)){
scriptOff();
if(useBattery)
use_battery();
}
if(downb){
go_down();
}else if (upb) {
go_up();
} else if (leftb) {
go_left();
}else if (rightb) {
go_right();
}
}
function go_left(){
if(GAME.mapcell[check_X()-1+'_'+check_y()]&&GAME.mapcell[check_X()-1+'_'+check_y()].m==1){
GAME.map_move(8);
} else {
leftb = false;
downb = true;
}
}
function go_right(){
if(GAME.mapcell[check_X()+1+'_'+check_y()]&&GAME.mapcell[check_X()+1+'_'+check_y()].m==1){
GAME.map_move(7);
} else {
rightb = false;
downb = true;
}
}
function go_down(){
downb = false;
if(check_y() >= (maxDown == 0 ? mapay : maxDown)){
upb = true;
}else{
GAME.map_move(1);
}

if(check_X() == (maxUp == 0 ? minX : maxLeft)){
rightb = true;
} else {
leftb = true;
}
}
function go_up(){
if(check_y() > (maxUp==0 ? minY : maxUp)){
GAME.map_move(2)
} else {
upb = false;
}
}
function check_X(){
return GAME.map_players[GAME.char_data.id].x;
}
function check_y(){
return GAME.map_players[GAME.char_data.id].y;
}
function kill_auto(){
GAME.emitOrder({a:13,mob_num:0,fo:GAME.map_options.ma});
}
function kill_mystic() {
$('[data-mob-rank="1"]').click();
$('#fight_con').css('display', 'none');
$('#fight_t1').css('display', 'none');
$('#fight_t0').css('display', 'none');
window.setTimeout(function() {
$('#fight_con').remove();
$('#fight_t1').remove();
$('#fight_t0').remove();
}, 100);
}
function kill_legend() {
$('[data-mob-rank="2"]').click();
$('#fight_con').css('display', 'none');
$('#fight_t1').css('display', 'none');
$('#fight_t0').css('display', 'none');
window.setTimeout(function() {
$('#fight_con').remove();
$('#fight_t1').remove();
$('#fight_t0').remove();
}, 100);
}
function kill_epic() {
//if('[data-option="qroup_attack"]')
//$('[data-option="qroup_attack"]').click();
$('[data-mob-rank="3"]').click();
$('#fight_con').css('display', 'none');
$('#fight_t1').css('display', 'none');
$('#fight_t0').css('display', 'none');
window.setTimeout(function() {
$('#fight_con').remove();
$('#fight_t1').remove();
$('#fight_t0').remove();
}, 100);
}
function use_blue(x){
GAME.emitOrder({a:12,type:14,iid:GAME.quick_opts.senzus[1].id,page:GAME.ekw_page,am:x})
}
function use_red(){
GAME.emitOrder({a:12,type:14,iid:GAME.quick_opts.senzus[1].id,page:GAME.ekw_page,am:1})
}
function use_battery(){

GAME.emitOrder({a:12,type:14,iid:$("div[data-base_item_id='1309']")[0].dataset.item_id,page:0});
}
function click_db(){

if($(".black_db").length>0){
if($(".black_db")[$(".black_db").length-1].style[3] != "opacity")
$(".black_db")[$(".black_db").length-1].click();
}
}
function kill_arena(){
if($(".right_btns .timer").length < 12 && arena_courent < 12)
{
GAME.emitOrder({a:46,type:1,index:arena_courent,quick:1});
arena_courent++;
window.setTimeout(start,500);
}else {
arena_courent = 0;
window.setTimeout(start,1000);
}
}

function collectBlueSenzu(){
if(collectBlueSenzuOn){
if(GAME.char_data.senzu_limit < max_Senzu){ //Sprawdzenie czy ilość zebranych fasolek jest mniejsza od maksymalnej dopuszczalnej liczby fasolek do zebrania
return true;
}else {
return false;
}
}else{
return true;
}
}

function stopIfAnotherPlayer(){
if(stopIfAnotherPlayerOn){
//if(Object.keys(GAME.map_players).length <= 2 && GAME.map_players[1499].y >=39){//Sprawdzanie czy na planszy sa inni gracze
if(Object.keys(GAME.map_players).length <= 1){
scriptOn();
return true;
}else{
scriptOff();
return false;
}
}else{
scriptOn();
return true;
}
}
function scriptOn(){
stop = false;
}
function scriptOff(){
console.log("scriptOff");
stop = true;
}
function killArena(){
kom_clear();
buttonArray = $( "button[data-option='arena_attack']");
if(buttonArray.length > arenaPlayerIndex)
{
//console.log(arenaPlayerIndex)
if(buttonArray[arenaPlayerIndex].classList[2] != "initial_hide_forced"){
window.setTimeout(GAME.emitOrder({a:46,type:1,index:buttonArray[arenaPlayerIndex].dataset.index,quick:1}),20);
}
if(arenaPlayerIndex >= 22){
arenaPlayerIndex = 1;
window.setTimeout(start,waitArena);
}
else{
arenaPlayerIndex = arenaPlayerIndex+2;
window.setTimeout(start,waitArena);
}
}else {
GAME.emitOrder({a:46,type:0});
buttonArray = $( "button[data-option='arena_attack']");
arenaPlayerIndex = 1;
window.setTimeout(start,waitArena);
}

}

function soulFight(){
GAME.emitOrder({a:59,type:0});
if($("#ss_cd_still")[0].style[0]=="display"){
console.log("soul fight");
window.setTimeout(soulFightGameFunction,waitArena);
window.setTimeout(closeFight,waitArena*2);

}
window.setTimeout(start,waitArena);
}
function soulFightGameFunction(){
GAME.emitOrder({a:59,type:1})
}
function closeFight(){
clearInterval(GAME.fight_timer);
$('#fight_view').fadeOut();
}
function checkTransform(){
if($("#ssj_bar")[0].attributes[2].value=="display: none;"){
window.setTimeout(useTransform,waitArena);
window.setTimeout(start,waitArena*2);
}else{
window.setTimeout(start,waitArena*2);
}

}
function useTransform(){

GAME.emitOrder({a:18,type:5,tech_id:81});
}
start();

}
GAME.emitOrder({a:12,page:GAME.ekw_page,used:1});
kill();

