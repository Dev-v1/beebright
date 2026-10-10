export const GAMES = [
 {id:'sky',title:'Sky Hopper',tag:'ONE BUTTON',description:'Thread a little glider through a sunset skyline.',controls:'Space / tap: flap',color:'#f3b66f'},
 {id:'sheep',title:'Sheep Escape',tag:'BRIDGE BUILDER',description:'Hold to grow a bridge upward, then release to lower it and lead your sheep across.',controls:'Hold mouse / touch / Space: grow · Release: lower bridge',color:'#a1d9a1'},
 {id:'gravity',title:'Gravity Flip',tag:'ENDLESS RUNNER',description:'Swap floor and ceiling to dodge the neon barriers.',controls:'Space / tap: flip gravity',color:'#d5a2ff'},
 {id:'bowling',title:'Pocket Bowling',tag:'FIVE FRAMES',description:'Aim carefully and knock down all ten pins. Two rolls per frame.',controls:'Left / right: aim · Up / down: power · Q / E: spin · Space / Roll: bowl',color:'#7ed9ee'},
 {id:'rally',title:'Neon Rally',tag:'3D · FOUR TRACKS',description:'Race four scenic circuits, from harbor bends to alpine hairpins and neon city streets.',controls:'Up: accelerate · Down: brake / reverse · Left / right: steer',color:'#ff97b3',three:true},
 {id:'dash',title:'Neon Dash',tag:'FIVE LEVELS',description:'Five long portal courses: jump as a cube, fly a ship, flip a ball and steer a wave.',controls:'Hold / tap: jump, fly or flip · Blue platforms are safe',color:'#a8b6ff',local:true},
 {id:'marble',title:'Marble Run 3D',tag:'3D · THREE COURSES',description:'Race against the clock through boosts, jump gaps, narrow turns and moving sweepers.',controls:'Arrow keys / WASD: roll · Space: jump · Q: brake',color:'#9de6da',local:true,three:true},
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
// Original long courses, separated by safe portal transitions.
const MODES=['cube','ship','ball','wave'];
export const DASH_LEVELS=['First Light','Afterglow','Pulse Drive','Moon Circuit','Neon Horizon'].map((name,level)=>{
 const length=9200+level*700,speed=170+level*10,section=length/4;
 const segments=MODES.map((mode,i)=>({mode,start:i*section,end:(i+1)*section}));
 const spikes=[650,1180,1750,section*2+600,section*2+1150,section*2+1740].filter(x=>x<length);
 const blocks=[{x:900,w:150,h:32},{x:1450,w:140,h:40}];
 return {name,speed,length,segments,spikes,blocks};
});
