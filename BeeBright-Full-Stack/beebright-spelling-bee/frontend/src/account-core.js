export function mergeAccountStudio(old={},incoming={}) {
  const events=new Map();
  for(const e of [...(old.events||[]),...(incoming.events||[])])if(e?.id)events.set(e.id,e);
  const games={...old.games};
  for(const [key,value]of Object.entries(incoming.games||{}))games[key]=Math.max(Number(games[key])||0,Number(value)||0);
  return {...old,...incoming,events:[...events.values()].sort((a,b)=>(a.at||0)-(b.at||0)).slice(-5000),favorites:[...new Set([...(old.favorites||[]),...(incoming.favorites||[])])],games};
}
