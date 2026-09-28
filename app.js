const directions = ["N","NE","E","SE","S","SW","W","NW"];
const dirDegrees = {N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315};
const movementMap = {
  "Broad Reach":5,
  "Beam Reach":4,
  "Running":4,
  "Close Hauled":3,
  "Into Wind":0
};

const raceCards = [
  {title:"Perfect Hoist", text:"If using Spinnaker, add +3 movement this turn.", apply:(p)=> p.sail==="Spinnaker" ? 3 : 0},
  {title:"Spinnaker Wrap", text:"If using Spinnaker, take −2 next turn.", penalty:{move:-2}},
  {title:"Great Tack", text:"If Close Hauled, add +2 movement this turn.", point:"Close Hauled", bonus:2},
  {title:"Bad Tack", text:"Take −2 movement next turn.", penalty:{move:-2}},
  {title:"Surfing", text:"If Running or Broad Reach, add +3 movement this turn.", bonusPoints:["Running","Broad Reach"], bonus:3},
  {title:"Clear Air", text:"Ignore any Dirty Air penalty next turn.", clearDirty:true},
  {title:"Caught a Lobster Pot", text:"Take −1 movement next turn.", penalty:{move:-1}},
  {title:"Crew Overboard", text:"Miss 1 movement point next turn.", penalty:{move:-1}},
  {title:"Perfect Wind Shift", text:"Rotate wind 45° in the direction that helps you. Use the wind buttons now."}
];

const windCards = [
  {title:"Wind Veers", text:"Wind rotates 45° clockwise.", shift:1},
  {title:"Wind Backs", text:"Wind rotates 45° anticlockwise.", shift:-1},
  {title:"Big Shift", text:"Wind rotates 90° clockwise.", shift:2},
  {title:"Big Back", text:"Wind rotates 90° anticlockwise.", shift:-2},
  {title:"Freshening Breeze", text:"All yachts get +1 movement this round.", global:1},
  {title:"Dying Breeze", text:"All yachts get −1 movement this round.", global:-1},
  {title:"Steady Breeze", text:"No wind change."}
];

let state = JSON.parse(localStorage.getItem("rtiState") || "null") || {
  players: [],
  turnIndex: 0,
  wind: "W",
  roundBonus: 0
};

const $ = (id)=>document.getElementById(id);
const playersList = $("playersList");
const playerDialog = $("playerDialog");
const addPlayerBtn = $("addPlayerBtn");
const playerForm = $("playerForm");
const playerNameInput = $("playerNameInput");
const boatColorInput = $("boatColorInput");
const turnControls = $("turnControls");
const nextTurnBtn = $("nextTurnBtn");
const turnPlayerName = $("turnPlayerName");
const turnStatus = $("turnStatus");
const legSelect = $("legSelect");
const movementValue = $("movementValue");
const pointOfSailBox = $("pointOfSailBox");
const eventMessage = $("eventMessage");
const penaltyBadge = $("penaltyBadge");
const windDirectionText = $("windDirectionText");
const windArrow = $("windArrow");

function save(){ localStorage.setItem("rtiState", JSON.stringify(state)); }

function activePlayer(){
  return state.players[state.turnIndex] || null;
}

function bearingToWindRelationship(leg, wind){
  const legDeg = dirDegrees[leg];
  const windFromDeg = dirDegrees[wind];
  const travelVsWind = (legDeg - ((windFromDeg + 180) % 360) + 360) % 360;
  const a = Math.min(travelVsWind, 360-travelVsWind);
  if(a <= 22.5) return "Running";
  if(a <= 67.5) return "Broad Reach";
  if(a <= 112.5) return "Beam Reach";
  if(a <= 157.5) return "Close Hauled";
  return "Into Wind";
}

function sailBonus(point, sail){
  if(sail==="Genoa" && point==="Close Hauled") return 1;
  if(sail==="Spinnaker" && (point==="Broad Reach" || point==="Running")) return 2;
  return 0;
}

function calcMovement(){
  const p = activePlayer();
  if(!p) return {point:"—", total:0, detail:""};
  const point = bearingToWindRelationship(legSelect.value, state.wind);
  let total = movementMap[point] + sailBonus(point, p.sail) + (p.tempBonus||0) + state.roundBonus;
  if(p.penaltyMove) total += p.penaltyMove;
  total = Math.max(0,total);
  return {point,total};
}

function updateCompass(){
  windDirectionText.textContent = state.wind;
  const deg = dirDegrees[state.wind];
  windArrow.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
}

function renderPlayers(){
  playersList.innerHTML = "";
  if(!state.players.length){
    playersList.innerHTML = '<div class="turn-status">No yachts yet. Add 2–6 players.</div>';
  }
  state.players.forEach((p,i)=>{
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <span class="boat-dot" style="background:${p.color}"></span>
      <div class="player-meta"><strong>${escapeHtml(p.name)}</strong><small>${p.sail} • ${p.missedTurn ? "Capsized / recovering" : "Ready"}</small></div>
      <span class="player-order">${i===state.turnIndex ? "TURN" : ""}</span>
      <button class="remove-btn" data-remove="${i}" aria-label="Remove">✕</button>`;
    playersList.appendChild(row);
  });
  document.querySelectorAll("[data-remove]").forEach(btn=>btn.onclick=()=>{
    const idx = Number(btn.dataset.remove);
    state.players.splice(idx,1);
    if(state.turnIndex >= state.players.length) state.turnIndex = 0;
    save(); render();
  });
}

function renderTurn(){
  const p = activePlayer();
  nextTurnBtn.disabled = !p;
  if(!p){
    turnControls.classList.add("hidden");
    turnPlayerName.textContent="Add players";
    turnStatus.textContent="Set up the fleet to begin.";
    return;
  }

  turnControls.classList.remove("hidden");
  $("activeYachtHeading").textContent = `${p.name}'s Turn`;
  turnPlayerName.textContent = p.name;

  if(p.missedTurn){
    turnStatus.textContent="Recovering from a capsize — no movement this turn.";
    movementValue.textContent="0";
    pointOfSailBox.querySelector(".big").textContent="Recovering";
    penaltyBadge.textContent="MISS TURN";
    penaltyBadge.classList.remove("hidden");
    return;
  }

  penaltyBadge.classList.toggle("hidden", !p.penaltyMove);
  if(p.penaltyMove){
    penaltyBadge.textContent = `${p.penaltyMove} NEXT MOVE`;
  }

  const {point,total} = calcMovement();
  pointOfSailBox.querySelector(".big").textContent = point;
  movementValue.textContent = total;
  turnStatus.textContent = `${p.sail} selected • ${point}`;
  document.querySelectorAll(".sail-btn").forEach(b=>b.classList.toggle("active", b.dataset.sail===p.sail));
}

function render(){
  updateCompass();
  renderPlayers();
  renderTurn();
}

function showMessage(title,text){
  eventMessage.innerHTML = `<strong>${escapeHtml(title)}</strong><br>${escapeHtml(text)}`;
  eventMessage.classList.remove("hidden");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}

addPlayerBtn.onclick=()=>{
  if(state.players.length>=6){ alert("Maximum 6 yachts."); return; }
  playerNameInput.value="";
  playerDialog.showModal();
  setTimeout(()=>playerNameInput.focus(),50);
};

playerForm.addEventListener("submit",(e)=>{
  if(!playerNameInput.value.trim()) return;
  state.players.push({
    name:playerNameInput.value.trim(),
    color:boatColorInput.value,
    sail:"Jib",
    missedTurn:false,
    penaltyMove:0,
    tempBonus:0,
    dirtyAir:false
  });
  save(); render();
});

document.querySelectorAll(".sail-btn").forEach(btn=>{
  btn.onclick=()=>{
    const p=activePlayer(); if(!p || p.missedTurn) return;
    p.sail=btn.dataset.sail;
    save(); renderTurn();
  };
});

legSelect.onchange=renderTurn;

$("windLeftBtn").onclick=()=>shiftWind(-1);
$("windRightBtn").onclick=()=>shiftWind(1);

function shiftWind(steps){
  let idx=directions.indexOf(state.wind);
  idx=(idx+steps+directions.length)%directions.length;
  state.wind=directions[idx];
  save(); render();
}

document.querySelectorAll("[data-event]").forEach(btn=>{
  btn.onclick=()=>{
    const p=activePlayer(); if(!p) return;
    const ev=btn.dataset.event;
    if(ev==="luckyGust"){ p.tempBonus=(p.tempBonus||0)+2; showMessage("Lucky Gust","+2 movement this turn."); }
    if(ev==="favourableTide"){ p.tempBonus=(p.tempBonus||0)+2; showMessage("Favourable Tide","+2 movement this turn."); }
    if(ev==="calmPatch"){ p.penaltyMove=(p.penaltyMove||0)-2; showMessage("Calm Patch","Take −2 movement next turn."); }
    if(ev==="dirtyAir"){ p.penaltyMove=(p.penaltyMove||0)-1; p.dirtyAir=true; showMessage("Dirty Air","Take −1 movement next turn."); }
    if(ev==="rocks"){ p.penaltyMove=(p.penaltyMove||0)-1; showMessage("Rocks","Take −1 movement next turn."); }
    if(ev==="capsize"){ p.missedTurn=true; showMessage("CAPSIZE!","Stop immediately. Miss your next turn while recovering."); }
    save(); renderTurn();
  };
});

$("drawRaceCardBtn").onclick=()=>{
  const p=activePlayer(); if(!p) return;
  const card=raceCards[Math.floor(Math.random()*raceCards.length)];
  let immediate = 0;
  if(card.apply) immediate += card.apply(p);
  if(card.point && calcMovement().point===card.point) immediate += card.bonus||0;
  if(card.bonusPoints && card.bonusPoints.includes(calcMovement().point)) immediate += card.bonus||0;
  if(immediate) p.tempBonus=(p.tempBonus||0)+immediate;
  if(card.penalty) p.penaltyMove=(p.penaltyMove||0)+(card.penalty.move||0);
  if(card.clearDirty && p.dirtyAir){ p.penaltyMove=Math.min(0,(p.penaltyMove||0)+1); p.dirtyAir=false; }
  showMessage(card.title,card.text);
  save(); renderTurn();
};

$("drawWindCardBtn").onclick=()=>{
  const card=windCards[Math.floor(Math.random()*windCards.length)];
  if(card.shift) shiftWind(card.shift);
  if(typeof card.global==="number") state.roundBonus=card.global;
  showMessage(card.title,card.text);
  save(); render();
};

nextTurnBtn.onclick=()=>{
  const p=activePlayer(); if(!p) return;

  if(p.missedTurn){
    p.missedTurn=false;
  } else {
    p.tempBonus=0;
    p.penaltyMove=0;
    p.dirtyAir=false;
  }

  eventMessage.classList.add("hidden");

  state.turnIndex++;
  if(state.turnIndex>=state.players.length){
    state.turnIndex=0;
    state.roundBonus=0;
  }
  save(); render();
};

$("resetRaceBtn").onclick=()=>{
  if(confirm("Reset the whole race and remove all yachts?")){
    localStorage.removeItem("rtiState");
    state={players:[],turnIndex:0,wind:"W",roundBonus:0};
    render();
  }
};

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
}

render();
