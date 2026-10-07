// Private offline fixture launcher. No product IPC or arbitrary command service.
using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.InteropServices;

public static class SunnyFixtureJob {
 public sealed class Result { public bool atomic {get;set;} public bool verified {get;set;} public bool cleanupObserved {get;set;} public uint activeProcesses {get;set;} public bool timedOut {get;set;} public bool forcedStop {get;set;} public int exitCode {get;set;} }
 [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long processTime,jobTime; public uint flags; public UIntPtr minimum,maximum; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
 [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits basic; public IoCounters io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
 [StructLayout(LayoutKind.Sequential)] struct Accounting { public long processTime,jobTime,periodProcessTime,periodJobTime; public uint faults,total,active,terminated; }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public int cb; public string reserved,desktop,title; public int x,y,width,height,charsX,charsY,fill,flags; public short show,reservedSize; public IntPtr reservedBytes,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct StartupEx { public Startup startup; public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] public struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
 public struct Attributes { public IntPtr list,value; }
 // Injection is confined to this offline script's pure contracts. The private
 // PowerShell entry constructs only WindowsNative; no renderer/API can select it.
 public interface Native { IntPtr NewJob();Attributes Prepare(IntPtr job);ProcessInfo Create(string runtime,string[] arguments,IntPtr attributes);bool Contains(IntPtr process,IntPtr job);void Resume(IntPtr thread);bool Exited(IntPtr process);int ExitCode(IntPtr process);uint Active(IntPtr job);void Terminate(IntPtr job);void Close(IntPtr handle);void Free(Attributes attributes); }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,ref ExtendedLimits value,uint length);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int info,out Accounting value,uint length,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr length,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref StartupEx startup,out ProcessInfo process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool answer);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 static void Need(bool ok) { if(!ok)throw new InvalidOperationException("Fixture containment unavailable"); }
 static string Quote(string value) { var text=new StringBuilder("\"");int slashes=0;foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='\"'){text.Append('\\',slashes*2+1).Append(c);slashes=0;continue;}text.Append('\\',slashes).Append(c);slashes=0;}return text.Append('\\',slashes*2).Append('"').ToString(); }
 static bool Expired(long deadline) { return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=deadline; }
 sealed class WindowsNative : Native {
  public IntPtr NewJob(){IntPtr job=CreateJobObject(IntPtr.Zero,null);Need(job!=IntPtr.Zero);try{var limits=new ExtendedLimits();limits.basic.flags=0x00002000;/* kill-on-close, no breakaway */Need(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf<ExtendedLimits>()));return job;}catch{CloseHandle(job);throw;}}
  public Attributes Prepare(IntPtr job){var value=new Attributes();bool initialized=false;try{IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);Need(size!=IntPtr.Zero);value.list=Marshal.AllocHGlobal(size);Need(InitializeProcThreadAttributeList(value.list,1,0,ref size));initialized=true;value.value=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(value.value,job);Need(UpdateProcThreadAttribute(value.list,0,(IntPtr)0x0002000D,value.value,(IntPtr)IntPtr.Size,IntPtr.Zero,IntPtr.Zero));return value;}catch{if(initialized)DeleteProcThreadAttributeList(value.list);if(value.list!=IntPtr.Zero)Marshal.FreeHGlobal(value.list);if(value.value!=IntPtr.Zero)Marshal.FreeHGlobal(value.value);throw;}}
  public ProcessInfo Create(string runtime,string[] arguments,IntPtr attributes){var startup=new StartupEx();startup.startup.cb=Marshal.SizeOf<StartupEx>();startup.startup.flags=1;startup.startup.show=0;startup.attributes=attributes;var command=new StringBuilder(Quote(runtime));foreach(string argument in arguments)command.Append(' ').Append(Quote(argument));ProcessInfo result;Need(CreateProcess(runtime,command,IntPtr.Zero,IntPtr.Zero,false,0x00080000|0x00000004|0x08000000,IntPtr.Zero,null,ref startup,out result));return result;}
  public bool Contains(IntPtr process,IntPtr job){bool answer;Need(IsProcessInJob(process,job,out answer));return answer;}
  public void Resume(IntPtr thread){Need(ResumeThread(thread)!=uint.MaxValue);}
  public bool Exited(IntPtr process){uint result=WaitForSingleObject(process,0);Need(result==0||result==258);return result==0;}
  public int ExitCode(IntPtr process){uint result;Need(GetExitCodeProcess(process,out result));return unchecked((int)result);}
  public uint Active(IntPtr job){Accounting value;Need(QueryInformationJobObject(job,1,out value,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero));return value.active;}
  public void Terminate(IntPtr job){Need(TerminateJobObject(job,124));}
  public void Close(IntPtr handle){CloseHandle(handle);}
  public void Free(Attributes value){if(value.list!=IntPtr.Zero){DeleteProcThreadAttributeList(value.list);Marshal.FreeHGlobal(value.list);}if(value.value!=IntPtr.Zero)Marshal.FreeHGlobal(value.value);}
 }
 public static Result Run(string runtime,string[] arguments,long deadline){return Run(runtime,arguments,deadline,new WindowsNative());}
 public static Result Run(string runtime,string[] arguments,long deadline,Native native,Func<Func<ProcessInfo>,Task<ProcessInfo>> launchTaskFactory=null){
  var result=new Result{exitCode=1,activeProcesses=uint.MaxValue};IntPtr job=IntPtr.Zero;Attributes attributes=new Attributes();ProcessInfo info=new ProcessInfo();Task<ProcessInfo> launch=null;bool creationCollected=false;
  try{
   Need(!Expired(deadline));job=native.NewJob();attributes=native.Prepare(job);result.atomic=true;Need(!Expired(deadline));
   launch=launchTaskFactory==null?Task.Run(()=>native.Create(runtime,arguments,attributes.list)):launchTaskFactory(()=>native.Create(runtime,arguments,attributes.list));
   while(!launch.Wait(25)){if(Expired(deadline)){result.timedOut=true;throw new TimeoutException();}}
   info=launch.GetAwaiter().GetResult();creationCollected=true;Need(native.Contains(info.process,job));result.verified=true;
   Need(!Expired(deadline));native.Resume(info.thread);
   while(!native.Exited(info.process)){if(Expired(deadline)){result.timedOut=true;throw new TimeoutException();}Thread.Sleep(25);}
   result.exitCode=native.ExitCode(info.process);result.activeProcesses=native.Active(job);result.cleanupObserved=result.activeProcesses==0;
   // Primary exit can precede descendant exit or the Job accounting update.
   // Observe the first count, then require an actual empty sample within
   // this fixed natural drain and the original absolute cleanup ceiling.
   var naturalEnd=Math.Min(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+2000,deadline+3000);
   while(!result.cleanupObserved&&!Expired(naturalEnd)){Thread.Sleep(25);result.activeProcesses=native.Active(job);result.cleanupObserved=result.activeProcesses==0;}
  }catch{result.exitCode=1;result.timedOut=result.timedOut||Expired(deadline);}
  finally{
   // Capture this before any zero-active sample. A later completion cannot turn
   // that earlier sample (or job closure) into observed process termination.
   bool unresolvedCreation=launch!=null&&!creationCollected;
   if(job!=IntPtr.Zero){try{if(!result.cleanupObserved){result.forcedStop=true;result.exitCode=1;try{native.Terminate(job);}catch{}var end=Math.Min(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()+2000,deadline+5000);do{try{result.activeProcesses=native.Active(job);result.cleanupObserved=result.activeProcesses==0;}catch{}if(result.cleanupObserved)break;Thread.Sleep(25);}while(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<end);}}finally{native.Close(job);}}
   // A pending CreateProcess still owns its attribute buffers. The launcher
   // exits after reporting; do not free memory underneath that native call.
   if(launch==null||launch.IsCompleted){if(launch!=null&&!creationCollected){try{info=launch.GetAwaiter().GetResult();creationCollected=true;}catch{}}if(info.thread!=IntPtr.Zero)native.Close(info.thread);if(info.process!=IntPtr.Zero)native.Close(info.process);native.Free(attributes);}
   if(unresolvedCreation)result.cleanupObserved=false;
  }
  return result;
 }
}
