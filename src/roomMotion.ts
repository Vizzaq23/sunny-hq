export const ROOM_STATION_CREW=['nami','franky','zoro'] as const;
export const ROOM_BOARD_X=34;
export type RoomActorPosition={y:number;moving:boolean};
export function stepRoomActor(current:RoomActorPosition,activity:{working:boolean;attention:boolean},seconds:number,reduced:boolean):RoomActorPosition{
 if(activity.attention)return {y:current.y,moving:false};
 const target=activity.working?52:67;
 if(reduced)return {y:target,moving:false};
 const distance=target-current.y,step=Math.min(Math.abs(distance),Math.max(0,Math.min(.2,seconds))*10);
 const y=current.y+Math.sign(distance)*step;
 return {y,moving:Math.abs(target-y)>.001};
}
