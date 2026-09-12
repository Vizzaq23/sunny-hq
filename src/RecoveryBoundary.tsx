import {Component,type ErrorInfo,type ReactNode} from 'react';

export class RecoveryBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(_error:Error,_info:ErrorInfo){
  void window.sunny?.invoke('app:diagnostic',{event:'renderer-error'}).catch(()=>{});
 }
 render(){
  if(!this.state.failed)return this.props.children;
  return <main className="recovery-screen" role="alert"><span>Sunny HQ</span><h1>Let’s get your workspace back.</h1><p>The interface encountered an error. Your saved projects and conversations have not been reset. Active work may still be running.</p><button onClick={()=>window.sunny?void window.sunny.invoke('app:reload').catch(()=>{}):location.reload()}>Reload Sunny</button><button onClick={()=>void window.sunny?.invoke('app:diagnostics').catch(()=>{})}>Open diagnostics folder</button></main>;
 }
}
