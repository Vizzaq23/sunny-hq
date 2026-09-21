import {useEffect,useRef} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type {Project} from '../shared';
type Invoke=<T=unknown>(action:string,args?:unknown)=>Promise<T>;
export function TerminalPane({project,invoke}:{project:Project;invoke:Invoke}){
  const host=useRef<HTMLDivElement>(null),term=useRef<Terminal|null>(null),id=useRef<string|undefined>(undefined);
  useEffect(()=>{if(!host.current)return;let disposed=false,remove:undefined|(()=>void);const terminal=new Terminal({fontFamily:"'Cascadia Code',Consolas,monospace",fontSize:13,theme:{background:'#0d292c',foreground:'#e8e4d7',cursor:'#ef7b52',selectionBackground:'#315456'}});const fit=new FitAddon();terminal.loadAddon(fit);terminal.open(host.current);fit.fit();term.current=terminal;void invoke<{id:string}>('terminal:create',{projectId:project.id}).then(session=>{if(disposed){void invoke('terminal:close',{id:session.id}).catch(()=>{});return;}id.current=session.id;terminal.onData(data=>void invoke('terminal:write',{id:session.id,data}).catch(()=>{}));remove=window.sunny?.subscribe(event=>{if(event.type==='terminal:data'&&event.data.id===session.id)terminal.write(event.data.data);if(event.type==='terminal:exit'&&event.data.id===session.id)terminal.writeln(`\r\n[process exited ${event.data.exitCode}]`);});}).catch(error=>{if(!disposed)terminal.writeln(`\r\n[terminal unavailable: ${error instanceof Error?error.message:String(error)}]`);});const resize=new ResizeObserver(()=>{fit.fit();if(id.current)void invoke('terminal:resize',{id:id.current,cols:terminal.cols,rows:terminal.rows}).catch(()=>{});});resize.observe(host.current);return()=>{disposed=true;resize.disconnect();remove?.();const sessionId=id.current;id.current=undefined;if(sessionId)void invoke('terminal:close',{id:sessionId}).catch(()=>{});terminal.dispose();};},[project.id,invoke]);
  return <div className="terminal-pane" ref={host}/>;
}
