export const GAMES = [
 {id:'sky',title:'Sky Hopper',tag:'ONE BUTTON',description:'Thread a little glider through a sunset skyline.',controls:'Space / tap: flap',color:'#f3b66f'},
 {id:'sheep',title:'Sheep Escape',tag:'RESCUE',description:'Lead four sheep home and steer clear of the roaming wolves.',controls:'Arrow keys / WASD: move',color:'#a1d9a1'},
 {id:'gravity',title:'Gravity Flip',tag:'ENDLESS RUNNER',description:'Swap floor and ceiling to dodge the neon barriers.',controls:'Space / tap: flip gravity',color:'#d5a2ff'},
 {id:'bowling',title:'Pocket Bowling',tag:'FIVE FRAMES',description:'Aim carefully and knock down all ten pins. Two rolls per frame.',controls:'Left / right: aim · Up / down: power · Q / E: spin · Space / Roll: bowl',color:'#7ed9ee'},
 {id:'rally',title:'Neon Rally',tag:'3D · THREE LAPS',description:'Drive a glowing circuit. Stay on the track for a faster lap.',controls:'Up: accelerate · Down: brake / reverse · Left / right: steer',color:'#ff97b3',three:true},
 {id:'dash',title:'Neon Dash',tag:'FIVE LEVELS',description:'Jump through five handcrafted courses, with an original synth soundtrack.',controls:'Space / tap: jump · blue blocks are safe platforms',color:'#a8b6ff',local:true},
 {id:'marble',title:'Marble Run 3D',tag:'3D · THREE COURSES',description:'Roll through ramps, winding bridges and floating courses with crystal checkpoints.',controls:'Arrow keys / WASD: roll · Space: jump',color:'#9de6da',local:true,three:true},
 {id:'space',title:'Space Survival 3D',tag:'3D · ARCADE',description:'Battle formations of alien ships, dodge diving fighters and collect shield energy.',controls:'Arrow keys / WASD: fly · Space: fire',color:'#e7bbff',local:true,three:true},
];
export const availableGames = local => GAMES.filter(g=>local || !g.local);
export function breakAfter(completed,total,challenge=false) {
 if(challenge || completed<50 || completed>total || (completed!==total && completed%50!==0))return null;
 return {minutes:completed===total?25:10,after:completed===total?'results':'practice',completed};
}
export const secondsLeft = (deadline,now=Date.now()) => Math.max(0,Math.ceil((deadline-now)/1000));
export const clock = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
export function normalizeScores(scores) {
 return Object.fromEntries(GAMES.map(g=>[g.id,Math.max(0,Math.min(1e9,Number(scores?.[g.id])||0))]));
}
// Comfortable introductory courses; blue platforms are safe to land on.
export const DASH_LEVELS = [
 {name:'First Light',speed:165,length:2400,spikes:[650,1180,1750,2200],blocks:[{x:910,w:120,h:32},{x:1470,w:140,h:38}]},
 {name:'Afterglow',speed:180,length:2800,spikes:[650,1200,1760,2310,2650],blocks:[{x:930,w:130,h:38},{x:2020,w:140,h:42}]},
 {name:'Pulse Drive',speed:195,length:3200,spikes:[680,1250,1820,2400,2900],blocks:[{x:980,w:140,h:42},{x:2100,w:150,h:48}]},
 {name:'Moon Circuit',speed:205,length:3500,spikes:[700,1280,1860,2440,3020,3370],blocks:[{x:1000,w:140,h:45},{x:2150,w:150,h:50}]},
 {name:'Neon Horizon',speed:215,length:3900,spikes:[720,1300,1880,2460,3040,3620],blocks:[{x:1000,w:150,h:48},{x:2180,w:160,h:52},{x:3340,w:140,h:44}]},
];
