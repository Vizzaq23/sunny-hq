export type CaptainDirection='north'|'south'|'east'|'west';
export type IslandPoint={x:number;y:number};
export const ISLAND_ZOOM_MIN=.75;
export const ISLAND_ZOOM_MAX=4;
export const ISLAND_ZOOM_STEP=.25;
const movement:Record<CaptainDirection,IslandPoint>={north:{x:0,y:-1.5},south:{x:0,y:1.5},east:{x:1.5,y:0},west:{x:-1.5,y:0}};
export function moveCaptainPosition(point:IslandPoint,direction:CaptainDirection):IslandPoint{
 const delta=movement[direction];
 return {x:Math.min(98,Math.max(2,point.x+delta.x)),y:Math.min(98,Math.max(2,point.y+delta.y))};
}
