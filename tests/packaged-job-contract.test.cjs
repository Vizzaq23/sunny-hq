const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
test('compiled launcher control uses only injected fake native operations for all failure branches',()=>{
 const source=path.resolve(__dirname,'../scripts/packaged-job.cs'),pwsh=(process.env.PATH||'').split(path.delimiter).map(dir=>path.join(dir,'pwsh.exe')).find(file=>fs.existsSync(file));assert.ok(pwsh);
 const fake=String.raw`
public static class FixtureJobContracts {
 sealed class Fake : SunnyFixtureJob.Native {
  public string fail="";public bool resumed,terminated,closedJob,freed,contained=true,hangLaunch,hangExit,closedProcess,closedThread;public int count;public System.Threading.Tasks.TaskCompletionSource<SunnyFixtureJob.ProcessInfo> lateAtClose;
  void Check(string step){if(fail==step)throw new System.InvalidOperationException(step);}
  public System.IntPtr NewJob(){Check("job");return (System.IntPtr)101;}
  public SunnyFixtureJob.Attributes Prepare(System.IntPtr job){Check("attributes");return new SunnyFixtureJob.Attributes{list=(System.IntPtr)102,value=(System.IntPtr)103};}
  public SunnyFixtureJob.ProcessInfo Create(string runtime,string[] args,System.IntPtr attrs){Check("create");if(hangLaunch)System.Threading.Thread.Sleep(250);count=1;return new SunnyFixtureJob.ProcessInfo{process=(System.IntPtr)104,thread=(System.IntPtr)105,pid=41};}
  public bool Contains(System.IntPtr process,System.IntPtr job){Check("verify");return contained;}
  public void Resume(System.IntPtr thread){Check("resume");resumed=true;}
  public bool Exited(System.IntPtr process){Check("wait");if(hangExit)return false;count=0;return true;}
  public int ExitCode(System.IntPtr process){return 0;}
  public uint Active(System.IntPtr job){Check("observe");return (uint)count;}
  public void Terminate(System.IntPtr job){if(job!=(System.IntPtr)101)throw new System.Exception("foreign job");terminated=true;count=0;}
  public void Close(System.IntPtr handle){if(handle==(System.IntPtr)101){closedJob=true;if(lateAtClose!=null)lateAtClose.SetResult(new SunnyFixtureJob.ProcessInfo{process=(System.IntPtr)104,thread=(System.IntPtr)105,pid=41});}if(handle==(System.IntPtr)104)closedProcess=true;if(handle==(System.IntPtr)105)closedThread=true;}
  public void Free(SunnyFixtureJob.Attributes attrs){freed=true;}
 }
 static SunnyFixtureJob.Result Run(Fake fake,int budget=1000){return SunnyFixtureJob.Run("never-executed",new string[0],System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+budget,fake);}
 static void Need(bool yes,string why){if(!yes)throw new System.Exception(why);}
 public static void Verify(){
  var success=new Fake();var ok=Run(success);Need(ok.exitCode==0&&ok.atomic&&ok.verified&&ok.cleanupObserved&&!ok.forcedStop&&success.resumed&&success.freed&&success.closedJob,"success proof");
  foreach(string step in new[]{"job","attributes","create","verify","resume","wait","observe"}){var fake=new Fake{fail=step};var result=Run(fake,50);Need(result.exitCode!=0,"failure accepted "+step);if(step!="job")Need(fake.closedJob,"job leak "+step);if(step!="job"&&step!="attributes")Need(fake.freed,"attribute leak "+step);if(step=="create"||step=="verify")Need(!fake.resumed,"failed containment resumed");if(step=="observe")Need(!result.cleanupObserved,"observation failure called cleanup");}
  var denied=new Fake{contained=false};var deniedResult=Run(denied);Need(!denied.resumed&&denied.terminated&&denied.closedJob&&deniedResult.exitCode!=0,"foreign membership resumed");
  var late=new Fake{hangLaunch=true};var lateResult=Run(late,20);Need(lateResult.timedOut&&!late.resumed&&late.closedJob&&!late.freed&&!lateResult.cleanupObserved,"late launch resources/resume");
  var gate=new System.Threading.Tasks.TaskCompletionSource<SunnyFixtureJob.ProcessInfo>();var raced=new Fake{lateAtClose=gate};var racedResult=SunnyFixtureJob.Run("never-executed",new string[0],System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+20,raced,operation=>gate.Task);Need(racedResult.timedOut&&!racedResult.cleanupObserved,"late completion after zero-active observation falsely proved cleanup");Need(raced.closedProcess&&raced.closedThread&&raced.freed&&!raced.resumed,"late process/thread handles were not collected and closed without resume");
  var stuck=new Fake{hangExit=true};var stopped=Run(stuck,20);Need(stopped.timedOut&&stopped.forcedStop&&stopped.cleanupObserved&&stuck.terminated&&stuck.closedJob,"owned timeout");
 }
}`;
 const script=`$ErrorActionPreference='Stop'\nAdd-Type -TypeDefinition ((Get-Content -LiteralPath '${source.replaceAll("'","''")}' -Raw) + [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(fake).toString('base64')}')))\n[FixtureJobContracts]::Verify()\n'PURE_JOB_CONTRACTS_PASSED_NO_NATIVE_ADAPTER'`;
 const result=cp.spawnSync(pwsh,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',timeout:20000});assert.equal(result.status,0,result.stderr||result.error?.message);assert.match(result.stdout,/PURE_JOB_CONTRACTS_PASSED_NO_NATIVE_ADAPTER/);
});
