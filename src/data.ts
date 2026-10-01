import islandResidents from '../desktop/island-residents.json';
import type {Crew, CrewId, Snapshot} from './shared';

export const CREW: Crew[] = [
  {id:'luffy',name:'Luffy',role:'Captain & Pathfinder',color:'#df5b3f',station:'Lion’s Head',description:'Turns a fuzzy ambition into a brave, concrete first move.'},
  {id:'zoro',name:'Zoro',role:'Code Review & Security',color:'#4e7259',station:'Training Deck',description:'Cuts through brittle code, risky assumptions, and noisy diffs.'},
  {id:'nami',name:'Nami',role:'Research & Planning',color:'#e7893d',station:'Chart Room',description:'Maps the shortest route through research, scope, and tradeoffs.'},
  {id:'usopp',name:'Usopp',role:'QA & Prototyping',color:'#a87942',station:'Workshop',description:'Stress-tests ideas and builds scrappy proofs before the big bet.'},
  {id:'sanji',name:'Sanji',role:'Product & Polish',color:'#c99932',station:'Galley',description:'Refines product flows, presentation, and the final ten percent.'},
  {id:'chopper',name:'Chopper',role:'Debugging & Support',color:'#d77588',station:'Sick Bay',description:'Diagnoses confusing failures patiently and restores healthy builds.'},
  {id:'robin',name:'Robin',role:'Knowledge & Docs',color:'#70568b',station:'Library',description:'Finds buried context and leaves durable, lucid documentation.'},
  {id:'franky',name:'Franky',role:'Architecture & DevOps',color:'#2588a1',station:'Engine Room',description:'Builds sturdy systems, automations, and delightfully useful tools.'},
  {id:'brook',name:'Brook',role:'Creative & Writing',color:'#45465d',station:'Music Room',description:'Finds voice, rhythm, wit, and memorable creative directions.'},
  {id:'jinbe',name:'Jinbe',role:'Strategy & Operations',color:'#27687a',station:'Helm',description:'Keeps complex missions calm, aligned, and moving with purpose.'},
];

export const RESIDENT_CATALOG:Crew[]=islandResidents;
export const ALL_CREW=[...CREW,...RESIDENT_CATALOG];
export const CREW_BY_ID = new Map<CrewId,Crew>(ALL_CREW.map(member=>[member.id,member]));

export const EMPTY_SNAPSHOT: Snapshot = {
  workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},persistence:{state:'saved',failures:0},
  projects:[],tasks:[],tools:[],approvals:[],models:[],usage:null,automations:[],
  settings:{reducedMotion:false,notifications:true,roomSoundEnabled:false,roomSoundVolume:.32,model:undefined},
  codex:{status:'desktop-required'},
};

export const MISSIONS = [
  {id:'job',eyebrow:'Career',title:'Land the next role',crewId:'nami' as CrewId,icon:'BriefcaseBusiness',summary:'Research a target company, tailor a resume, and rehearse the interview.',prompt:'Help me run a focused job hunt. Start by asking for the role, company, and materials I already have. Then make a practical plan, research gaps, and a first deliverable.'},
  {id:'neetcode',eyebrow:'Study',title:'NeetCode training voyage',crewId:'zoro' as CrewId,icon:'Braces',summary:'Build a steady practice loop with explanations, hints, and review.',prompt:'Coach me through a NeetCode practice session. Assess my current level, pick a useful problem pattern, and guide me with progressive hints before showing a solution.'},
  {id:'tcg',eyebrow:'Play',title:'Tune a TCG deck',crewId:'usopp' as CrewId,icon:'Layers3',summary:'Analyze the list, curve, matchups, and the highest-impact swaps.',prompt:'Help me improve a trading card game deck. Ask for the game, format, deck list, budget, and problems I am seeing, then analyze the list and propose prioritized changes.'},
  {id:'creative',eyebrow:'Create',title:'Make something memorable',crewId:'brook' as CrewId,icon:'Sparkles',summary:'Shape a loose idea into a strong concept and finished creative.',prompt:'Be my creative partner. Help me turn a loose idea into a distinctive concept, explore a few directions, choose one with me, and produce a polished first version.'},
  {id:'dev',eyebrow:'Build',title:'Ship a software feature',crewId:'franky' as CrewId,icon:'Blocks',summary:'Scope, implement, test, and package a reviewable code change.',prompt:'Help me ship a software feature in this project. Inspect the codebase, clarify the intended behavior, propose a concise implementation approach, implement it, and verify the result.'},
];

export const TOOL_SHORTCUTS = [
  {id:'terminal',name:'Terminal',category:'Development',description:'Open a project shell and run local commands.',status:'desktop required'},
  {id:'preview',name:'Local preview',category:'Development',description:'Open a local app preview beside your work.',status:'desktop required'},
  {id:'obsidian',name:'Obsidian library',category:'Knowledge',description:'Search and edit your connected knowledge base.',status:'desktop required'},
  {id:'github',name:'GitHub',category:'Delivery',description:'Review branches, diffs, and pull requests.',status:'desktop required'},
];

export const formatRelative = (time:number) => {
  const delta=Math.max(0,Date.now()-time), minutes=Math.floor(delta/60000);
  if(minutes<1)return 'just now'; if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60); if(hours<24)return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
};

export const shortPath=(path:string)=>path.replace(/\\/g,'/').split('/').slice(-2).join('/');
