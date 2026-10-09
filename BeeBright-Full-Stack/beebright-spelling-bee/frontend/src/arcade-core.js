export const GAMES = [
 {id:'sky',title:'Sky Hopper',tag:'ONE BUTTON',description:'Thread a little glider through a sunset skyline.',controls:'Space / tap: flap',color:'#f3b66f'},
 {id:'sheep',title:'Sheep Escape',tag:'RESCUE',description:'Lead four sheep home and steer clear of the roaming wolves.',controls:'Arrow keys / WASD: move',color:'#a1d9a1'},
 {id:'gravity',title:'Gravity Flip',tag:'ENDLESS RUNNER',description:'Swap floor and ceiling to dodge the neon barriers.',controls:'Space / tap: flip gravity',color:'#d5a2ff'},
 {id:'bowling',title:'Pocket Bowling',tag:'FIVE FRAMES',description:'Aim carefully and knock down all ten pins. Two rolls per frame.',controls:'Left / right: aim · Space / Roll: bowl',color:'#7ed9ee'},
 {id:'rally',title:'Neon Rally',tag:'THREE LAPS',description:'Drive a glowing circuit. Stay on the track for a faster lap.',controls:'Up: accelerate · Down: brake · Left / right: steer',color:'#ff97b3'},
 {id:'dash',title:'Neon Dash',tag:'FIVE LEVELS',description:'Jump through five handcrafted courses, with an original synth soundtrack.',controls:'Space / tap: jump · hold to jump on landing',color:'#a8b6ff',local:true},
 {id:'marble',title:'Marble Run 3D',tag:'3D · THREE COURSES',description:'Roll across floating platforms, collect crystals and reach the finish.',controls:'Arrow keys / WASD: roll · Space: jump',color:'#9de6da',local:true,three:true},
 {id:'space',title:'Space Survival 3D',tag:'3D · ARCADE',description:'Pilot through an asteroid field, collect energy and fire laser pulses.',controls:'Arrow keys / WASD: fly · Space: fire',color:'#e7bbff',local:true,three:true},
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
// Original courses, intentionally separated by at least one landing/jump interval.
export const DASH_LEVELS = [
 {name:'First Light',speed:225,length:2800,spikes:[520,920,1320,1760,2140,2520],blocks:[{x:1120,w:70,h:35},{x:1920,w:80,h:35}]},
 {name:'Afterglow',speed:250,length:3300,spikes:[520,560,980,1430,1470,1960,2400,2440,2920],blocks:[{x:1160,w:90,h:45},{x:2180,w:90,h:40}]},
 {name:'Pulse Drive',speed:270,length:3800,spikes:[580,620,1110,1560,1600,2160,2200,2670,3200,3240],blocks:[{x:1320,w:90,h:50},{x:2900,w:90,h:40}]},
 {name:'Moon Circuit',speed:285,length:4200,spikes:[610,650,1140,1180,1720,1760,2310,2350,2910,2950,3530,3570],blocks:[{x:1400,w:90,h:45},{x:2630,w:90,h:45},{x:3840,w:90,h:35}]},
 {name:'Neon Horizon',speed:300,length:4700,spikes:[620,660,1140,1180,1740,1780,2300,2340,2900,2940,3500,3540,4100,4140],blocks:[{x:1420,w:80,h:45},{x:2630,w:80,h:45},{x:3830,w:80,h:40}]},
];
