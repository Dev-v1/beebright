export function publicRoute(path, signedIn) {
  if(path==='/games')return 'games';
  if(path==='/'&&!signedIn)return 'home';
  return null;
}
