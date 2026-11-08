import {useEffect,useRef,useState} from 'react';
import Editor,{loader} from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment={getWorker(_:string,label:string){if(label==='json')return new jsonWorker();if(label==='css'||label==='scss'||label==='less')return new cssWorker();if(label==='html'||label==='handlebars'||label==='razor')return new htmlWorker();if(label==='typescript'||label==='javascript')return new tsWorker();return new editorWorker();}};
loader.config({monaco});

const languageFor=(path:string)=>{const ext=path.split('.').pop()?.toLowerCase();return ({ts:'typescript',tsx:'typescript',js:'javascript',jsx:'javascript',json:'json',css:'css',scss:'scss',html:'html',md:'markdown',py:'python',yml:'yaml',yaml:'yaml',sh:'shell',ps1:'powershell'} as Record<string,string>)[ext??'']??'plaintext';};

export function CodeEditor({path,value,onChange,readOnly=false}:{path:string;value:string;onChange:(value:string)=>void;readOnly?:boolean}){
  const [dark,setDark]=useState(()=>document.documentElement.dataset.appearance==='dark');
  useEffect(()=>{const sync=()=>setDark(document.documentElement.dataset.appearance==='dark');const appearanceObserver=new MutationObserver(sync);appearanceObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-appearance']});sync();return()=>appearanceObserver.disconnect();},[]);
  const host=useRef<HTMLDivElement>(null),observer=useRef<ResizeObserver|null>(null),timer=useRef<number|undefined>(undefined);
  useEffect(()=>{monaco.editor.defineTheme('sunny',{base:'vs',inherit:true,rules:[{token:'comment',foreground:'829087',fontStyle:'italic'},{token:'keyword',foreground:'126B70'},{token:'string',foreground:'B55E3A'}],colors:{'editor.background':'#FBF7EE','editor.foreground':'#243C3F','editorLineNumber.foreground':'#A6A195','editorLineNumber.activeForeground':'#D65F3E','editor.selectionBackground':'#DCEAE3','editor.lineHighlightBackground':'#F4EEDF','editorCursor.foreground':'#D65F3E'}});},[]);
  useEffect(()=>()=>{observer.current?.disconnect();if(timer.current)window.clearTimeout(timer.current);},[]);
  return <div className="code-editor-host" ref={host}><Editor width="100%" height="100%" path={path} value={value} language={languageFor(path)} theme={dark?'vs-dark':'sunny'} options={{automaticLayout:false,minimap:{enabled:false},fontFamily:"'Cascadia Code','SFMono-Regular',Consolas,monospace",fontSize:13,lineHeight:21,padding:{top:16},scrollBeyondLastLine:false,wordWrap:'on',readOnly,renderLineHighlight:'line',overviewRulerBorder:false,hideCursorInOverviewRuler:true}} onMount={editor=>{const layout=()=>{const element=host.current;if(element&&element.clientWidth>0&&element.clientHeight>0)editor.layout({width:element.clientWidth,height:element.clientHeight});};observer.current?.disconnect();observer.current=new ResizeObserver(layout);if(host.current)observer.current.observe(host.current);layout();timer.current=window.setTimeout(layout,120);}} onChange={next=>onChange(next??'')}/></div>;
}
