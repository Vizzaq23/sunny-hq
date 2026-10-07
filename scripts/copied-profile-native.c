#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <bcrypt.h>
/* Fixed offline capture tool, outside renderer and ordinary startup.
 * The reviewed private per-generation header supplies only literal paths,
 * fresh nonce and exact input digests. No arguments or caller executor.
 * Compile diagnostics containing that header must already have private stdio.
 * The unchanged outer atomic Job supplies the absolute 120+5 ceiling. */
#include "copied-profile-private.h"
#define CAP (256u*1024u*1024u)
static HANDLE files[4], ancestors[128], pins[4], sealed[2], receipt_handle;
static BYTE sealed_hash[2][32];static BY_HANDLE_FILE_INFORMATION sealed_info[2];
#ifdef COPIED_SYNTHETIC_FIXTURE
static BOOL preparing_fixture,positive_rename,positive_restore,positive_identity,positive_acl;
static DWORD synthetic_exit=0xffffffff,denial_count;
typedef struct {DWORD operation,member,error;BOOL denied;} Denial;
static Denial denial_events[17];
static void record_denial(DWORD operation,DWORD member,BOOL denied,DWORD error){if(denial_count<17){Denial *event=&denial_events[denial_count++];event->operation=operation;event->member=member;event->denied=denied;event->error=error;}}
#endif
static DWORD ancestor_count;
static BYTE before_hash[4][32];
static BY_HANDLE_FILE_INFORMATION before_info[4];
static HANDLE input_handle, output_handle, error_handle;
static PSECURITY_DESCRIPTOR private_sd;
static PSID user_sid;
static BYTE token_buffer[4096], system_sid[SECURITY_MAX_SID_SIZE];
typedef struct {DWORD stage,active,error;} OwnedCount;

static OwnedCount owned_counts[192];static DWORD owned_count;
static DWORD capture_exit=0xffffffff,copy_exit=0xffffffff;
static BOOL observe_owned(HANDLE job,DWORD stage,DWORD *active){JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;BOOL ok=QueryInformationJobObject(job,JobObjectBasicAccountingInformation,&accounting,sizeof(accounting),NULL);DWORD error=ok?0:GetLastError();*active=ok?accounting.ActiveProcesses:0xffffffff;if(owned_count>=192)return FALSE;OwnedCount *event=&owned_counts[owned_count++];event->stage=stage;event->active=*active;event->error=error;return ok;}
static BOOL drain_owned(HANDLE job,DWORD stage){DWORD active;ULONGLONG end=GetTickCount64()+2000;for(;;){if(!observe_owned(job,stage,&active))return FALSE;if(active==0)return TRUE;if(GetTickCount64()>=end)return FALSE;Sleep(25);}}
static const WCHAR *names[4]={SOURCE L"\\sunny.sqlite",SOURCE L"\\sunny.sqlite-wal",SOURCE L"\\sunny.sqlite-shm",SOURCE L"\\chatgpt-history.json"};
static void zero(void *p,DWORD n){volatile BYTE *v=(volatile BYTE *)p;while(n--)*v++=0;}
static BOOL equal(const void *a,const void *b,DWORD n){const BYTE *x=a,*y=b;while(n--)if(*x++!=*y++)return FALSE;return TRUE;}
static BOOL clear_environment(const WCHAR *name){if(!SetEnvironmentVariableW(name,NULL)&&GetLastError()!=ERROR_ENVVAR_NOT_FOUND)return FALSE;SetLastError(ERROR_SUCCESS);return GetEnvironmentVariableW(name,NULL,0)==0&&GetLastError()==ERROR_ENVVAR_NOT_FOUND;}
static BOOL write_bytes(HANDLE h,const char *p,DWORD n){DWORD wrote=0;return WriteFile(h,p,n,&wrote,NULL)&&wrote==n&&FlushFileBuffers(h);}
static BOOL same_identity(const BY_HANDLE_FILE_INFORMATION *a,const BY_HANDLE_FILE_INFORMATION *b){return a->dwVolumeSerialNumber==b->dwVolumeSerialNumber&&a->nFileIndexHigh==b->nFileIndexHigh&&a->nFileIndexLow==b->nFileIndexLow;}
static BOOL final_path(HANDLE h,const WCHAR *expected){static WCHAR actual[1024],bound[1024];DWORD n=GetFinalPathNameByHandleW(h,actual,1024,FILE_NAME_NORMALIZED|VOLUME_NAME_DOS);if(!n||n>=1024)return FALSE;lstrcpyW(bound,L"\\\\?\\");lstrcatW(bound,expected);return lstrcmpiW(actual,bound)==0;}
static BOOL ordinary(HANDLE h,const WCHAR *name,BOOL directory,BY_HANDLE_FILE_INFORMATION *info){
 if(!GetFileInformationByHandle(h,info)||!final_path(h,name))return FALSE;
 if(info->dwFileAttributes&FILE_ATTRIBUTE_REPARSE_POINT)return FALSE;
 if(!!(info->dwFileAttributes&FILE_ATTRIBUTE_DIRECTORY)!=!!directory)return FALSE;
 if(!directory&&(info->nNumberOfLinks!=1||info->nFileSizeHigh||info->nFileSizeLow>CAP))return FALSE;
 return TRUE;
}
static BOOL protected_acl(const WCHAR *name){
 PSECURITY_DESCRIPTOR sd=NULL;PACL dacl=NULL;PSID owner=NULL;BOOL ok=FALSE;SECURITY_DESCRIPTOR_CONTROL control;DWORD revision;
 if(GetNamedSecurityInfoW((WCHAR *)name,SE_FILE_OBJECT,OWNER_SECURITY_INFORMATION|DACL_SECURITY_INFORMATION,&owner,NULL,&dacl,NULL,&sd)!=ERROR_SUCCESS)return FALSE;
 if(!owner||!EqualSid(owner,user_sid)||!dacl||dacl->AceCount!=2||!GetSecurityDescriptorControl(sd,&control,&revision)||!(control&SE_DACL_PROTECTED))goto done;
 BOOL got_user=FALSE,got_system=FALSE;
 for(DWORD i=0;i<2;i++){void *entry=NULL;if(!GetAce(dacl,i,&entry))goto done;ACCESS_ALLOWED_ACE *ace=entry;
  if(ace->Header.AceType!=ACCESS_ALLOWED_ACE_TYPE||(ace->Header.AceFlags&INHERITED_ACE)||ace->Mask!=FILE_ALL_ACCESS)goto done;
  if(EqualSid(&ace->SidStart,user_sid))got_user=TRUE;else if(EqualSid(&ace->SidStart,system_sid))got_system=TRUE;else goto done;
 }
 ok=got_user&&got_system;
done:if(sd)LocalFree(sd);return ok;
}
static BOOL make_private(void){
 HANDLE token=NULL;DWORD bytes=0,system_size=sizeof(system_sid);LPWSTR sid_string=NULL;WCHAR sddl[512];
 if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))return FALSE;
 BOOL ok=GetTokenInformation(token,TokenUser,token_buffer,sizeof(token_buffer),&bytes);CloseHandle(token);if(!ok)return FALSE;
 user_sid=((TOKEN_USER *)token_buffer)->User.Sid;
 if(!CreateWellKnownSid(WinLocalSystemSid,NULL,system_sid,&system_size)||!ConvertSidToStringSidW(user_sid,&sid_string))return FALSE;
 lstrcpyW(sddl,L"O:");lstrcatW(sddl,sid_string);lstrcatW(sddl,L"D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;");lstrcatW(sddl,sid_string);lstrcatW(sddl,L")");LocalFree(sid_string);
 if(!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl,SDDL_REVISION_1,&private_sd,NULL))return FALSE;
 SECURITY_ATTRIBUTES sa;zero(&sa,sizeof(sa));sa.nLength=sizeof(sa);sa.lpSecurityDescriptor=private_sd;
 // Parent work/private is created in preparation without any data. Generation
 // must be fresh; existing directories are never adopted, deleted, or repaired.
 if(!CreateDirectoryW(BASE,&sa)||!protected_acl(BASE))return FALSE;
 const WCHAR *directories[6]={BASE L"\\acquisition",BASE L"\\baseline",BASE L"\\working",BASE L"\\control",BASE L"\\consumer-output",BASE L"\\temp"};for(DWORD i=0;i<6;i++)if(!CreateDirectoryW(directories[i],&sa)||!protected_acl(directories[i]))return FALSE;
 sa.bInheritHandle=TRUE;
 input_handle=CreateFileW(BASE L"\\stdin.empty",GENERIC_READ|GENERIC_WRITE,FILE_SHARE_READ,&sa,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);
 output_handle=CreateFileW(BASE L"\\stdout.private.log",GENERIC_WRITE,FILE_SHARE_READ,&sa,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);
 error_handle=CreateFileW(BASE L"\\stderr.private.log",GENERIC_WRITE,FILE_SHARE_READ,&sa,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);
 return input_handle!=INVALID_HANDLE_VALUE&&output_handle!=INVALID_HANDLE_VALUE&&error_handle!=INVALID_HANDLE_VALUE;
}
static BOOL hold_ancestors(const WCHAR *path){
 WCHAR current[1024];lstrcpyW(current,path);
 for(;;){if(ancestor_count>=128)return FALSE;HANDLE h=CreateFileW(current,FILE_READ_ATTRIBUTES,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,NULL);BY_HANDLE_FILE_INFORMATION info;
  if(h==INVALID_HANDLE_VALUE)return FALSE;
  if(!ordinary(h,current,TRUE,&info)){CloseHandle(h);return FALSE;}ancestors[ancestor_count++]=h;
  int n=lstrlenW(current);if(n==3&&current[1]==L':'&&current[2]==L'\\')break;
  while(n>3&&current[n-1]!=L'\\')n--;if(n<=3)current[3]=0;else current[n-1]=0;
 }
 return TRUE;
}
static BOOL hash_handle(HANDLE file,BYTE hash[32]){
 BCRYPT_ALG_HANDLE alg=NULL;BCRYPT_HASH_HANDLE state=NULL;BYTE *buffer=NULL;BOOL ok=FALSE;LARGE_INTEGER start;start.QuadPart=0;
 if(!SetFilePointerEx(file,start,NULL,FILE_BEGIN)||BCryptOpenAlgorithmProvider(&alg,BCRYPT_SHA256_ALGORITHM,NULL,0)<0)goto done;
 if(BCryptCreateHash(alg,&state,NULL,0,NULL,0,0)<0)goto done;
 buffer=HeapAlloc(GetProcessHeap(),0,65536);if(!buffer)goto done;
 for(;;){DWORD got=0;if(!ReadFile(file,buffer,65536,&got,NULL))goto done;if(!got)break;if(BCryptHashData(state,buffer,got,0)<0)goto done;}
 ok=BCryptFinishHash(state,hash,32,0)>=0;
done:if(buffer)HeapFree(GetProcessHeap(),0,buffer);if(state)BCryptDestroyHash(state);if(alg)BCryptCloseAlgorithmProvider(alg,0);return ok;
}
static BOOL pin_inputs(void){
 const WCHAR *paths[3]={HOST,CAPTURE_WORKER,COPIED_WORKER};
 const BYTE expected[3][32]={HOST_SHA256,CAPTURE_WORKER_SHA256,COPIED_WORKER_SHA256};
 for(DWORD i=0;i<3;i++){pins[i]=CreateFileW(paths[i],GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);BY_HANDLE_FILE_INFORMATION info;
  if(pins[i]==INVALID_HANDLE_VALUE||!GetFileInformationByHandle(pins[i],&info)||info.dwFileAttributes&(FILE_ATTRIBUTE_REPARSE_POINT|FILE_ATTRIBUTE_DIRECTORY)||info.nNumberOfLinks!=1||!final_path(pins[i],paths[i]))return FALSE;
 }
 BYTE hash[32];for(DWORD i=0;i<3;i++)if(!hash_handle(pins[i],hash)||!equal(hash,expected[i],32))return FALSE;return TRUE;
}
static DWORD child(BOOL generator){
 STARTUPINFOEXW startup;PROCESS_INFORMATION process;SIZE_T size=0;DWORD result=90;BOOL created=FALSE,initialized=FALSE,drained=FALSE;static WCHAR command[4096];HANDLE job=NULL;
 zero(&startup,sizeof(startup));zero(&process,sizeof(process));startup.StartupInfo.cb=sizeof(startup);startup.StartupInfo.dwFlags=STARTF_USESTDHANDLES|STARTF_USESHOWWINDOW;startup.StartupInfo.wShowWindow=SW_HIDE;
 // Unnamed/noninheritable child Job uses the same atomic JOB_LIST creation
 // pattern as the outer reviewed helper. The outer Job remains unchanged.
 job=CreateJobObjectW(NULL,NULL);if(!job)return result;
 JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits;zero(&limits,sizeof(limits));limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if(!SetInformationJobObject(job,JobObjectExtendedLimitInformation,&limits,sizeof(limits)))goto done;
 DWORD owned_active;if(!observe_owned(job,generator?1:4,&owned_active)||owned_active!=0){result=91;goto done;}
 startup.StartupInfo.hStdInput=input_handle;startup.StartupInfo.hStdOutput=output_handle;startup.StartupInfo.hStdError=error_handle;
 InitializeProcThreadAttributeList(NULL,2,0,&size);if(!size)goto done;
 startup.lpAttributeList=HeapAlloc(GetProcessHeap(),0,size);if(!startup.lpAttributeList)goto done;
 initialized=InitializeProcThreadAttributeList(startup.lpAttributeList,2,0,&size);
 HANDLE inherited[3]={input_handle,output_handle,error_handle};
 if(!initialized||!UpdateProcThreadAttribute(startup.lpAttributeList,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,sizeof(inherited),NULL,NULL))goto done;
 if(!UpdateProcThreadAttribute(startup.lpAttributeList,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,&job,sizeof(job),NULL,NULL))goto done;
 #ifdef COPIED_SYNTHETIC_FIXTURE
 if(preparing_fixture){lstrcpyW(command,L"\"" HOST L"\" \"" SYNTHETIC_GENERATOR L"\" \"" SOURCE L"\"");}else
#endif
 {lstrcpyW(command,L"\"" HOST L"\" \"");lstrcatW(command,generator?CAPTURE_WORKER:COPIED_WORKER);lstrcatW(command,L"\" \"" BASE);lstrcatW(command,generator?L"\\control\\request.json\"":L"\\control\\fixture.json\"");}
 // No CREATE_BREAKAWAY_FROM_JOB. Additional inner Job has no breakaway flag.
 created=CreateProcessW(HOST,command,NULL,NULL,TRUE,EXTENDED_STARTUPINFO_PRESENT|CREATE_SUSPENDED|CREATE_NO_WINDOW,NULL,BASE,&startup.StartupInfo,&process);
 if(!created)goto done;
 BOOL in_job=FALSE;if(!IsProcessInJob(process.hProcess,job,&in_job)||!in_job)goto failed;
 if(ResumeThread(process.hThread)==(DWORD)-1)goto failed;
 if(WaitForSingleObject(process.hProcess,INFINITE)!=WAIT_OBJECT_0||!GetExitCodeProcess(process.hProcess,&result))goto failed;
 // Synthetic preparation is a distinct child; it has not run capture yet.
#ifdef COPIED_SYNTHETIC_FIXTURE
 if(!preparing_fixture)
#endif
 {if(generator)capture_exit=result;else copy_exit=result;}
 drained=drain_owned(job,generator?2:5);if(!drained)result=91;
 goto done;
failed:result=90;
done:
 // Forced cleanup can never become passing even if it empties the owned Job.
 if(created&&!drained){TerminateJobObject(job,91);drain_owned(job,generator?3:6);if(result==0)result=91;}
 if(created){CloseHandle(process.hThread);CloseHandle(process.hProcess);}if(initialized)DeleteProcThreadAttributeList(startup.lpAttributeList);if(startup.lpAttributeList)HeapFree(GetProcessHeap(),0,startup.lpAttributeList);if(job)CloseHandle(job);return result;
}
static BOOL hold_sources(void){
 for(DWORD i=0;i<4;i++){files[i]=CreateFileW(names[i],GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);
  if(files[i]==INVALID_HANDLE_VALUE||!ordinary(files[i],names[i],FALSE,&before_info[i])||!before_info[i].nFileSizeLow||!hash_handle(files[i],before_hash[i]))return FALSE;
 }
 return TRUE;
}
static BOOL unchanged(void){
 for(DWORD i=0;i<4;i++){BY_HANDLE_FILE_INFORMATION after;BYTE hash[32];if(!ordinary(files[i],names[i],FALSE,&after)||!same_identity(&before_info[i],&after)||after.nFileSizeLow!=before_info[i].nFileSizeLow||!equal(&after.ftLastWriteTime,&before_info[i].ftLastWriteTime,sizeof(FILETIME))||!hash_handle(files[i],hash)||!equal(before_hash[i],hash,32))return FALSE;}
 return TRUE;
}
static BOOL copy_held(HANDLE source,const WCHAR *destination,const BYTE expected[32]){
 HANDLE target=CreateFileW(destination,GENERIC_READ|GENERIC_WRITE,FILE_SHARE_READ,NULL,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);if(target==INVALID_HANDLE_VALUE)return FALSE;
 BYTE *buffer=HeapAlloc(GetProcessHeap(),0,65536),hash[32];BOOL ok=FALSE;LARGE_INTEGER start;start.QuadPart=0;
 if(!buffer||!SetFilePointerEx(source,start,NULL,FILE_BEGIN))goto done;
 for(;;){DWORD got=0,wrote=0;if(!ReadFile(source,buffer,65536,&got,NULL))goto done;if(!got)break;if(!WriteFile(target,buffer,got,&wrote,NULL)||wrote!=got)goto done;}
 ok=FlushFileBuffers(target)&&hash_handle(target,hash)&&equal(hash,expected,32);
done:if(buffer)HeapFree(GetProcessHeap(),0,buffer);CloseHandle(target);return ok;
}
static BOOL capture_raw(void){
 const WCHAR *destinations[4]={BASE L"\\acquisition\\sunny.sqlite",BASE L"\\acquisition\\sunny.sqlite-wal",BASE L"\\acquisition\\sunny.sqlite-shm",BASE L"\\acquisition\\chatgpt-history.json"};
 ULONGLONG bytes=0;for(DWORD i=0;i<4;i++)bytes+=before_info[i].nFileSizeLow;if(bytes>512ull*1024ull*1024ull)return FALSE;
 for(DWORD i=0;i<4;i++)if(!copy_held(files[i],destinations[i],before_hash[i]))return FALSE;return TRUE;
}
static const WCHAR *sealed_paths[2]={BASE L"\\baseline\\sunny.sqlite",BASE L"\\baseline\\chatgpt-history.json"};
static BOOL seal_baseline(void){
 const WCHAR *working[2]={BASE L"\\working\\sunny.sqlite",BASE L"\\working\\chatgpt-history.json"};
 for(DWORD i=0;i<2;i++){
  sealed[i]=CreateFileW(sealed_paths[i],GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);
  if(sealed[i]==INVALID_HANDLE_VALUE||!ordinary(sealed[i],sealed_paths[i],FALSE,&sealed_info[i])||!sealed_info[i].nFileSizeLow||!hash_handle(sealed[i],sealed_hash[i]))return FALSE;
  HANDLE staged=CreateFileW(working[i],GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);BY_HANDLE_FILE_INFORMATION info;BYTE hash[32];
  if(staged==INVALID_HANDLE_VALUE)return FALSE;BOOL ok=ordinary(staged,working[i],FALSE,&info)&&!same_identity(&info,&sealed_info[i])&&info.nFileSizeLow==sealed_info[i].nFileSizeLow&&hash_handle(staged,hash)&&equal(hash,sealed_hash[i],32);CloseHandle(staged);if(!ok)return FALSE;
 }
 // Header-supplied nonce digest binds the native completion to the one fresh
 // reviewed generation. Logical worker output alone is never completed input.
 receipt_handle=CreateFileW(BASE L"\\control\\capture-receipt.json",GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);
 BY_HANDLE_FILE_INFORMATION receipt_info;BYTE complete[72]={'S','U','N','C','P','Y','1',0},nonce_hash[32]=NONCE_SHA256;
 if(receipt_handle==INVALID_HANDLE_VALUE||!ordinary(receipt_handle,BASE L"\\control\\capture-receipt.json",FALSE,&receipt_info)||receipt_info.nFileSizeLow>16384)return FALSE;
 for(DWORD i=0;i<32;i++)complete[8+i]=nonce_hash[i];if(!hash_handle(receipt_handle,complete+40))return FALSE;
 HANDLE output=CreateFileW(BASE L"\\control\\native-complete.bin",GENERIC_WRITE,0,NULL,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);if(output==INVALID_HANDLE_VALUE)return FALSE;
 BOOL ok=write_bytes(output,(const char *)complete,72);CloseHandle(output);return ok;
}
static BOOL baseline_unchanged(void){for(DWORD i=0;i<2;i++){BY_HANDLE_FILE_INFORMATION after;BYTE hash[32];if(!ordinary(sealed[i],sealed_paths[i],FALSE,&after)||!same_identity(&sealed_info[i],&after)||after.nFileSizeLow!=sealed_info[i].nFileSizeLow||!equal(&after.ftLastWriteTime,&sealed_info[i].ftLastWriteTime,sizeof(FILETIME))||!hash_handle(sealed[i],hash)||!equal(hash,sealed_hash[i],32))return FALSE;}return TRUE;}
static BOOL missing(const WCHAR *name){DWORD attributes=GetFileAttributesW(name);return attributes==INVALID_FILE_ATTRIBUTES&&GetLastError()==ERROR_FILE_NOT_FOUND;}
static BOOL environment(void){
 if(!SetEnvironmentVariableW(L"ELECTRON_RUN_AS_NODE",L"1")||!SetEnvironmentVariableW(L"SUNNY_FIXTURE_NONCE",NONCE)||!SetEnvironmentVariableW(L"TEMP",BASE L"\\temp")||!SetEnvironmentVariableW(L"TMP",BASE L"\\temp"))return FALSE;
 const WCHAR *names[11]={L"NODE_OPTIONS",L"NODE_PATH",L"ELECTRON_EXTRA_LAUNCH_ARGS",L"ELECTRON_ENABLE_LOGGING",L"ELECTRON_LOG_FILE",L"ELECTRON_ENABLE_STACK_DUMPING",L"ELECTRON_NO_ASAR",L"SUNNY_DEV_URL",L"SUNNY_DATA_DIR",L"SUNNY_PROVIDER_MISSION",L"SUNNY_LIVE_SMOKE"};
 for(DWORD i=0;i<11;i++)if(!clear_environment(names[i]))return FALSE;return TRUE;
}
static BOOL write_request(void){
 // REQUEST_JSON is a fixed literal reviewed with this per-generation header,
 // never argv, environment data, a template evaluated at runtime or saved data.
 HANDLE request=CreateFileW(BASE L"\\control\\request.json",GENERIC_WRITE,0,NULL,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);if(request==INVALID_HANDLE_VALUE)return FALSE;
 BOOL ok=write_bytes(request,REQUEST_JSON,(DWORD)lstrlenA(REQUEST_JSON));CloseHandle(request);return ok;
}
static void append_number(char *out,DWORD number){char reversed[11],value[11];DWORD n=0;do{reversed[n++]=(char)('0'+number%10);number/=10;}while(number);for(DWORD i=0;i<n;i++)value[i]=reversed[n-i-1];value[n]=0;lstrcatA(out,value);}
static BOOL record_identities(void){
 HANDLE out=CreateFileW(BASE L"\\control\\held-identities.private.bin",GENERIC_WRITE,0,NULL,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);if(out==INVALID_HANDLE_VALUE)return FALSE;
 BOOL ok=write_bytes(out,(const char *)before_info,sizeof(before_info))&&write_bytes(out,(const char *)before_hash,sizeof(before_hash));
 for(DWORD i=0;i<4&&ok;i++){BY_HANDLE_FILE_INFORMATION info;BYTE hash[32];ok=ordinary(files[i],names[i],FALSE,&info)&&hash_handle(files[i],hash)&&write_bytes(out,(const char *)&info,sizeof(info))&&write_bytes(out,(const char *)hash,sizeof(hash));}CloseHandle(out);return ok;
}
static BOOL record_result(DWORD code,BOOL source_stable,BOOL baseline_stable){
 static char text[16384];lstrcpyA(text,"{\"version\":1,\"nativeExit\":");append_number(text,code);lstrcatA(text,",\"captureExit\":");append_number(text,capture_exit);lstrcatA(text,",\"copyExit\":");append_number(text,copy_exit);lstrcatA(text,",\"sourceUnchanged\":");lstrcatA(text,source_stable?"true":"false");lstrcatA(text,",\"baselineUnchanged\":");lstrcatA(text,baseline_stable?"true":"false");lstrcatA(text,",\"ownedCounts\":[");
 for(DWORD i=0;i<owned_count;i++){if(i)lstrcatA(text,",");lstrcatA(text,"{\"stage\":");append_number(text,owned_counts[i].stage);lstrcatA(text,",\"active\":");append_number(text,owned_counts[i].active);lstrcatA(text,",\"error\":");append_number(text,owned_counts[i].error);lstrcatA(text,"}");}lstrcatA(text,"]");
#ifdef COPIED_SYNTHETIC_FIXTURE
 lstrcatA(text,",\"syntheticExit\":");append_number(text,synthetic_exit);lstrcatA(text,",\"positiveIdentityAcl\":");lstrcatA(text,positive_rename&&positive_restore&&positive_identity&&positive_acl?"true":"false");lstrcatA(text,",\"denials\":[");for(DWORD i=0;i<denial_count;i++){if(i)lstrcatA(text,",");lstrcatA(text,"{\"operation\":");append_number(text,denial_events[i].operation);lstrcatA(text,",\"member\":");append_number(text,denial_events[i].member);lstrcatA(text,",\"error\":");append_number(text,denial_events[i].error);lstrcatA(text,",\"denied\":");lstrcatA(text,denial_events[i].denied?"true":"false");lstrcatA(text,"}");}lstrcatA(text,"]");
#endif
 lstrcatA(text,"}");
 HANDLE report=CreateFileW(BASE L"\\native-result.private.json",GENERIC_WRITE,0,NULL,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,NULL);if(report==INVALID_HANDLE_VALUE)return FALSE;BOOL ok=write_bytes(report,text,(DWORD)lstrlenA(text));CloseHandle(report);return ok;
}
static void close_all(void){for(DWORD i=0;i<4;i++)if(files[i]&&files[i]!=INVALID_HANDLE_VALUE)CloseHandle(files[i]);for(DWORD i=0;i<2;i++)if(sealed[i]&&sealed[i]!=INVALID_HANDLE_VALUE)CloseHandle(sealed[i]);if(receipt_handle&&receipt_handle!=INVALID_HANDLE_VALUE)CloseHandle(receipt_handle);for(DWORD i=0;i<ancestor_count;i++)CloseHandle(ancestors[i]);for(DWORD i=0;i<4;i++)if(pins[i]&&pins[i]!=INVALID_HANDLE_VALUE)CloseHandle(pins[i]);if(input_handle&&input_handle!=INVALID_HANDLE_VALUE)CloseHandle(input_handle);if(output_handle&&output_handle!=INVALID_HANDLE_VALUE)CloseHandle(output_handle);if(error_handle&&error_handle!=INVALID_HANDLE_VALUE)CloseHandle(error_handle);if(private_sd)LocalFree(private_sd);}
#ifdef COPIED_SYNTHETIC_FIXTURE
static BOOL directory_positive_control(void){
 // Fresh empty synthetic directory only, before strict source handle or any
 // generator. This is not an operation on an acquired/existing profile.
 WIN32_FIND_DATAW entry;HANDLE find=FindFirstFileW(SOURCE L"\\*",&entry);if(find==INVALID_HANDLE_VALUE)return FALSE;
 BOOL empty=TRUE;DWORD entries=0;do{if(++entries>2||(lstrcmpW(entry.cFileName,L".")!=0&&lstrcmpW(entry.cFileName,L"..")!=0)){empty=FALSE;break;}}while(FindNextFileW(find,&entry));DWORD find_error=GetLastError();FindClose(find);if(!empty||find_error!=ERROR_NO_MORE_FILES)return FALSE;
 HANDLE handle=CreateFileW(SOURCE,FILE_READ_ATTRIBUTES,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,NULL,OPEN_EXISTING,FILE_FLAG_BACKUP_SEMANTICS|FILE_FLAG_OPEN_REPARSE_POINT,NULL);if(handle==INVALID_HANDLE_VALUE)return FALSE;
 BY_HANDLE_FILE_INFORMATION before,after;BOOL ok=ordinary(handle,SOURCE,TRUE,&before)&&protected_acl(SOURCE);
 if(ok){positive_rename=MoveFileExW(SOURCE,SOURCE L".positive-rename",0);if(positive_rename)positive_restore=MoveFileExW(SOURCE L".positive-rename",SOURCE,0);if(positive_restore){positive_identity=ordinary(handle,SOURCE,TRUE,&after)&&same_identity(&before,&after);positive_acl=protected_acl(SOURCE);}}
 CloseHandle(handle);return ok&&positive_rename&&positive_restore&&positive_identity&&positive_acl;
}
static BOOL denied_sources(void){
 for(DWORD i=0;i<4;i++){
  HANDLE write=CreateFileW(names[i],GENERIC_READ|GENERIC_WRITE,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,NULL,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,NULL);
  DWORD error=write==INVALID_HANDLE_VALUE?GetLastError():0;record_denial(1,i,write==INVALID_HANDLE_VALUE,error);if(write!=INVALID_HANDLE_VALUE){CloseHandle(write);return FALSE;}if(error!=ERROR_SHARING_VIOLATION)return FALSE;
  HANDLE mapping=CreateFileMappingW(files[i],NULL,PAGE_READWRITE,0,0,NULL);error=mapping?0:GetLastError();record_denial(2,i,mapping==NULL,error);if(mapping){CloseHandle(mapping);return FALSE;}if(error!=ERROR_ACCESS_DENIED)return FALSE;
  BOOL removed=DeleteFileW(names[i]);error=removed?0:GetLastError();record_denial(3,i,!removed,error);if(removed||error!=ERROR_SHARING_VIOLATION)return FALSE;
  WCHAR changed[1024];lstrcpyW(changed,names[i]);lstrcatW(changed,L".forbidden-rename");BOOL renamed=MoveFileExW(names[i],changed,0);error=renamed?0:GetLastError();record_denial(4,i,!renamed,error);if(renamed||error!=ERROR_SHARING_VIOLATION)return FALSE;
 }
 BOOL renamed=MoveFileExW(SOURCE,SOURCE L".forbidden-rename",0);DWORD error=renamed?0:GetLastError();record_denial(5,4,!renamed,error);if(!positive_rename||!positive_restore||!positive_identity||!positive_acl||renamed||(error!=ERROR_SHARING_VIOLATION&&error!=ERROR_ACCESS_DENIED))return FALSE;
 return TRUE;
}
static BOOL prepare_synthetic(void){
 SECURITY_ATTRIBUTES sa;zero(&sa,sizeof(sa));sa.nLength=sizeof(sa);sa.lpSecurityDescriptor=private_sd;
 if(!CreateDirectoryW(SOURCE,&sa)||!protected_acl(SOURCE)||!directory_positive_control()||!hold_ancestors(SOURCE))return FALSE;
 pins[3]=CreateFileW(SYNTHETIC_GENERATOR,GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);BY_HANDLE_FILE_INFORMATION info;BYTE digest[32],expected[32]=SYNTHETIC_GENERATOR_SHA256;
 if(pins[3]==INVALID_HANDLE_VALUE||!ordinary(pins[3],SYNTHETIC_GENERATOR,FALSE,&info)||!hash_handle(pins[3],digest)||!equal(digest,expected,32))return FALSE;
 preparing_fixture=TRUE;synthetic_exit=child(TRUE);preparing_fixture=FALSE;return synthetic_exit==0;
}
#endif
static BOOL fixed_paths(void){
 const WCHAR *paths[7]={BASE,SOURCE,OWN,HOST,CAPTURE_WORKER,COPIED_WORKER,PRIVATE_PARENT};
 for(DWORD i=0;i<7;i++)if(lstrlenW(paths[i])>800||paths[i][1]!=L':'||paths[i][2]!=L'\\')return FALSE;
 int base=lstrlenW(BASE),source=lstrlenW(SOURCE);int common=base<source?base:source;BOOL prefix=TRUE;for(int i=0;i<common;i++)if(BASE[i]!=SOURCE[i])prefix=FALSE;
 return !(prefix&&(base==source||(base<source&&SOURCE[base]==L'\\')||(source<base&&BASE[source]==L'\\')));
}
void WINAPI copied_entry(void){
 DWORD code=80;BOOL sink=FALSE,locks=FALSE,sealed_ok=FALSE,source_stable=FALSE,baseline_stable=FALSE;WCHAR filesystem[32];
 if(!fixed_paths())goto finish;
 if(GetDriveTypeW(SOURCE_DRIVE)!=DRIVE_FIXED||!GetVolumeInformationW(SOURCE_DRIVE,NULL,0,NULL,NULL,NULL,filesystem,32)||lstrcmpiW(filesystem,L"NTFS")!=0)goto finish;
 if(!hold_ancestors(PRIVATE_PARENT)||!hold_ancestors(OWN))goto finish;
 sink=make_private();if(!sink)goto finish;
  if(!environment()||!hold_ancestors(BASE L"\\baseline")||!hold_ancestors(WORKER_PARENT)||!pin_inputs()||!write_request()){code=81;goto finish;}
#ifdef COPIED_SYNTHETIC_FIXTURE
 if(!prepare_synthetic()){code=26;goto finish;}
#else
 if(!hold_ancestors(SOURCE)){code=81;goto finish;}
#endif
 if(!missing(SOURCE L"\\state.json")||!missing(SOURCE L"\\sunny.sqlite-journal")){code=23;goto finish;}
 if(missing(SOURCE L"\\chatgpt-history.json")){code=22;goto finish;}
  if(!hold_sources()){code=21;goto finish;}locks=TRUE;
#ifdef COPIED_SYNTHETIC_FIXTURE
 if(!denied_sources()){code=82;goto verify;}
#endif
 if(!capture_raw()){code=24;goto verify;}
 code=child(TRUE);if(code)goto verify;
 source_stable=unchanged();if(!source_stable){code=83;goto finish;}
 if(!seal_baseline()){code=25;goto verify;}sealed_ok=TRUE;
 code=child(FALSE);
verify:
 if(locks){source_stable=unchanged();if(!source_stable)code=83;}
 if(sealed_ok){baseline_stable=baseline_unchanged();if(!baseline_stable)code=84;}
finish:
 if(locks&&!record_identities())code=85;
 if(sink&&!record_result(code,source_stable,baseline_stable))code=85;
 close_all();ExitProcess(code);
}
