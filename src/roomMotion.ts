export const ROOM_STATION_CREW=['nami','franky','zoro'] as const;
// Percentage coordinates for the uncropped 3:2 project-quarters illustration.
export const ROOM_BOARD_X=46;
export const ROOM_STATION_X=[32,57,79] as const;
export function moveRoomCaptain(p:{x:number;y:number},dx:number,dy:number){
 return {x:Math.max(34,Math.min(78,p.x+dx)),y:Math.max(52,Math.min(76,p.y+dy))};
}
export function nearRoomBoard(p:{x:number;y:number}){return p.y<=56&&Math.abs(p.x-ROOM_BOARD_X)<=8;}
export type RoomActorPosition={y:number;moving:boolean};
export function stepRoomActor(current:RoomActorPosition,activity:{working:boolean;attention:boolean},seconds:number,reduced:boolean,paused=false):RoomActorPosition{
 if(activity.attention)return {y:current.y,moving:false};
 if(paused)return {y:current.y,moving:false};
 const target=activity.working?52:67;
 if(reduced)return {y:target,moving:false};
 const distance=target-current.y,step=Math.min(Math.abs(distance),Math.max(0,Math.min(.2,seconds))*10);
 const y=current.y+Math.sign(distance)*step;
 return {y,moving:Math.abs(target-y)>.001};
}
