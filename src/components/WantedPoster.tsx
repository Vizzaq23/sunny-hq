import type {Crew} from '../shared';

// Story-world reference data, never a work metric. Sources: docs/wanted-poster-references.md.
const bounties:Record<string,number>={luffy:3000000000,zoro:1111000000,nami:366000000,usopp:500000000,sanji:1032000000,chopper:1000,robin:930000000,franky:394000000,brook:383000000,jinbe:1100000000,law:3000000000,ace:550000000};
const names:Record<string,string>={luffy:'Monkey D. Luffy',zoro:'Roronoa Zoro',usopp:'God Usopp',sanji:'Vinsmoke Sanji',chopper:'Tony Tony Chopper',robin:'Nico Robin',law:'Trafalgar Law',ace:'Portgas D. Ace',vivi:'Nefertari Vivi'};
export function posterName(crew:Crew){return names[crew.id]??crew.name;}
export function WantedPortrait({crew}:{crew:Crew}){
 const core=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
 const extras=['law','ace','vivi','perona'];
 const isCore=core.includes(crew.id),index=(isCore?core:extras).indexOf(crew.id),columns=isCore?5:2;
 return <span className="wanted-photo" role="img" aria-label={`${crew.name}, ${crew.role}`} style={{backgroundImage:`url("${import.meta.env.BASE_URL}assets/${isCore?'crew-sheet':'wanted-allies'}.png")`,backgroundSize:isCore?'800% 520%':'200% 200%',backgroundPosition:isCore?`${(index%5*160+30)/7}% ${(Math.floor(index/5)*260+78)/4.2}%`:`${index%2*100}% ${Math.floor(index/2)*100}%`}}/>;
}
export function WantedBounty({crew}:{crew:Crew}){
 const bounty=bounties[crew.id];
 return <span className="wanted-reward"><span className="wanted-bounty" aria-label={bounty?`${bounty.toLocaleString('en-US')} Berries, ${crew.id==='ace'?'last known':'story'} bounty`:'Bounty not published'}>{bounty?<><span className="berry-symbol" aria-hidden="true">฿</span> {bounty.toLocaleString('en-US')}</>:'UNKNOWN'}</span><span className="wanted-imprint"><small>{bounty?(crew.id==='ace'?'LAST KNOWN BOUNTY':'BERRIES'):'BOUNTY NOT PUBLISHED'}</small><b aria-hidden="true">MARINE</b></span></span>;
}
