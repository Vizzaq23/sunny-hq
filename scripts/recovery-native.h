#ifndef SUNNY_RECOVERY_NATIVE_H
#define SUNNY_RECOVERY_NATIVE_H
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <aclapi.h>
#include <sddl.h>
#include <bcrypt.h>
#include <winternl.h>
/* Generated in a private, fixed build directory. Never selected at runtime. */
#include "recovery-release-private.h"
#define R_PATH 1024
#define R_DESCRIPTOR 16384
#define R_CAP (256u*1024u*1024u)
typedef struct {HANDLE handle;BY_HANDLE_FILE_INFORMATION info;BYTE hash[32];WCHAR path[R_PATH];} Held;
typedef struct {DWORD magic,version,pid;FILETIME created;UINT64 input,output,error;} Hello;
typedef struct {DWORD magic,version,parent,child;FILETIME parent_created,child_created;BYTE generation[16],descriptor_hash[32];BY_HANDLE_FILE_INFORMATION completion;WCHAR runtime[R_PATH];DWORD descriptor_length;BYTE descriptor[R_DESCRIPTOR];} Admission;
typedef struct {DWORD magic,version,parent,child;FILETIME parent_created,child_created;BYTE generation[16],descriptor_hash[32];DWORD format,compared,count,complete,reserved[4];} Completion;
typedef struct {char values[15][R_PATH];WCHAR source[R_PATH];BYTE exe[32],asar[32],bridge[32],bootstrap[32];BOOL json,archive_required;} Descriptor;
static Held chain[192];static DWORD chain_count;
static BYTE user_buffer[4096],system_buffer[SECURITY_MAX_SID_SIZE];static PSID user_sid,system_sid;static PSECURITY_DESCRIPTOR private_sd;
static void r_zero(void *p,SIZE_T n){volatile BYTE *v=p;while(n--)*v++=0;}
static void r_copy(void *p,const void *q,SIZE_T n){volatile BYTE *d=p;const volatile BYTE *s=q;while(n--)*d++=*s++;}
static BOOL r_equal(const void *p,const void *q,SIZE_T n){const BYTE *a=p,*b=q;while(n--)if(*a++!=*b++)return FALSE;return TRUE;}
static BOOL r_path(WCHAR *to,const WCHAR *base,const WCHAR *member){if(lstrlenW(base)+lstrlenW(member)+2>=R_PATH)return FALSE;lstrcpyW(to,base);lstrcatW(to,L"\\");lstrcatW(to,member);return TRUE;}
static BOOL r_identity(const BY_HANDLE_FILE_INFORMATION *a,const BY_HANDLE_FILE_INFORMATION *b){return a->dwVolumeSerialNumber==b->dwVolumeSerialNumber&&a->nFileIndexHigh==b->nFileIndexHigh&&a->nFileIndexLow==b->nFileIndexLow;}
static __attribute__((noinline)) BOOL r_user(void){HANDLE token;DWORD bytes=0,n=sizeof(system_buffer);LPWSTR sid=NULL;WCHAR sddl[512];if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))return FALSE;BOOL ok=GetTokenInformation(token,TokenUser,user_buffer,sizeof(user_buffer),&bytes);CloseHandle(token);if(!ok)return FALSE;user_sid=((TOKEN_USER *)user_buffer)->User.Sid;system_sid=system_buffer;if(!CreateWellKnownSid(WinLocalSystemSid,NULL,system_sid,&n)||!ConvertSidToStringSidW(user_sid,&sid))return FALSE;lstrcpyW(sddl,L"O:");lstrcatW(sddl,sid);lstrcatW(sddl,L"D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;");lstrcatW(sddl,sid);lstrcatW(sddl,L")");LocalFree(sid);return ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl,SDDL_REVISION_1,&private_sd,NULL);}
static BOOL r_security(HANDLE h,BOOL exact){PSECURITY_DESCRIPTOR sd=NULL;PSID owner=NULL;PACL acl=NULL;SECURITY_DESCRIPTOR_CONTROL control;DWORD revision;BOOL ok=FALSE;
 if(GetSecurityInfo(h,SE_FILE_OBJECT,OWNER_SECURITY_INFORMATION|DACL_SECURITY_INFORMATION,&owner,NULL,&acl,NULL,&sd)!=ERROR_SUCCESS)return FALSE;
 if(!owner||!acl||(!EqualSid(owner,user_sid)&&!EqualSid(owner,system_sid)&&!IsWellKnownSid(owner,WinBuiltinAdministratorsSid)))goto done;
 if(exact&&(!EqualSid(owner,user_sid)||acl->AceCount!=2||!GetSecurityDescriptorControl(sd,&control,&revision)||!(control&SE_DACL_PROTECTED)))goto done;
 BOOL user=FALSE,system=FALSE;for(DWORD i=0;i<acl->AceCount;i++){void *p=NULL;if(!GetAce(acl,i,&p))goto done;ACE_HEADER *header=p;if(header->AceType!=ACCESS_ALLOWED_ACE_TYPE){if(exact)goto done;continue;}ACCESS_ALLOWED_ACE *ace=p;PSID sid=&ace->SidStart;
  if(exact&&(ace->Mask!=FILE_ALL_ACCESS||(header->AceFlags&INHERITED_ACE)))goto done;
  if(EqualSid(sid,user_sid))user=TRUE;else if(EqualSid(sid,system_sid))system=TRUE;else if(exact)goto done;
 }ok=!exact||(user&&system);
done:if(sd)LocalFree(sd);return ok;}
static BOOL r_ordinary(HANDLE h,const WCHAR *name,BOOL directory,BY_HANDLE_FILE_INFORMATION *info){static WCHAR actual[R_PATH],expected[R_PATH];if(!GetFileInformationByHandle(h,info)||info->dwFileAttributes&FILE_ATTRIBUTE_REPARSE_POINT||!!(info->dwFileAttributes&FILE_ATTRIBUTE_DIRECTORY)!=!!directory)return FALSE;
 if(!directory&&(info->nNumberOfLinks!=1||info->nFileSizeHigh||info->nFileSizeLow>512u*1024u*1024u))return FALSE;
 if(lstrlenW(name)+4>=R_PATH)return FALSE;lstrcpyW(expected,L"\\\\?\\");lstrcatW(expected,name);DWORD n=GetFinalPathNameByHandleW(h,actual,R_PATH,FILE_NAME_NORMALIZED|VOLUME_NAME_DOS);return n&&n<R_PATH&&lstrcmpiW(actual,expected)==0;}
static BOOL r_hash(HANDLE h,BYTE result[32]){BCRYPT_ALG_HANDLE alg=NULL;BCRYPT_HASH_HANDLE hash=NULL;BYTE *buffer=NULL;LARGE_INTEGER start;start.QuadPart=0;BOOL ok=FALSE;
 if(!SetFilePointerEx(h,start,NULL,FILE_BEGIN)||BCryptOpenAlgorithmProvider(&alg,BCRYPT_SHA256_ALGORITHM,NULL,0)<0||BCryptCreateHash(alg,&hash,NULL,0,NULL,0,0)<0)goto done;
 buffer=HeapAlloc(GetProcessHeap(),0,65536);if(!buffer)goto done;for(;;){DWORD got=0;if(!ReadFile(h,buffer,65536,&got,NULL))goto done;if(!got)break;if(BCryptHashData(hash,buffer,got,0)<0)goto done;}ok=BCryptFinishHash(hash,result,32,0)>=0;
done:if(buffer)HeapFree(GetProcessHeap(),0,buffer);if(hash)BCryptDestroyHash(hash);if(alg)BCryptCloseAlgorithmProvider(alg,0);return ok;}
static BOOL r_hash_bytes(const BYTE *bytes,DWORD size,BYTE result[32]){BCRYPT_ALG_HANDLE alg=NULL;BCRYPT_HASH_HANDLE hash=NULL;BOOL ok=FALSE;if(BCryptOpenAlgorithmProvider(&alg,BCRYPT_SHA256_ALGORITHM,NULL,0)>=0&&BCryptCreateHash(alg,&hash,NULL,0,NULL,0,0)>=0&&BCryptHashData(hash,(BYTE *)bytes,size,0)>=0)ok=BCryptFinishHash(hash,result,32,0)>=0;if(hash)BCryptDestroyHash(hash);if(alg)BCryptCloseAlgorithmProvider(alg,0);return ok;}
static __attribute__((noinline)) BOOL r_hold(Held *file,const WCHAR *name,BOOL directory,BOOL exact){r_zero(file,sizeof(*file));if(lstrlenW(name)>=R_PATH)return FALSE;lstrcpyW(file->path,name);file->handle=CreateFileW(name,(directory?FILE_READ_ATTRIBUTES:GENERIC_READ)|READ_CONTROL,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT|(directory?FILE_FLAG_BACKUP_SEMANTICS:0),NULL);return file->handle!=INVALID_HANDLE_VALUE&&r_ordinary(file->handle,name,directory,&file->info)&&r_security(file->handle,exact)&&(directory||r_hash(file->handle,file->hash));}
static __attribute__((noinline)) BOOL r_ancestors(const WCHAR *directory,BOOL exact_leaf){WCHAR path[R_PATH];if(lstrlenW(directory)>=R_PATH||directory[1]!=L':'||directory[2]!=L'\\')return FALSE;lstrcpyW(path,directory);BOOL first=TRUE;for(;;){if(chain_count>=192)return FALSE;Held *item=&chain[chain_count++];if(!r_hold(item,path,TRUE,first&&exact_leaf))return FALSE;first=FALSE;int n=lstrlenW(path);if(n==3)break;while(n>3&&path[n-1]!=L'\\')n--;if(n<=3)path[3]=0;else path[n-1]=0;}return TRUE;}
static __attribute__((noinline)) BOOL r_file_parents(const WCHAR *file){WCHAR path[R_PATH];int n=lstrlenW(file);if(n>=R_PATH||n<4)return FALSE;lstrcpyW(path,file);while(n>3&&path[n-1]!=L'\\')n--;if(n<=3)path[3]=0;else path[n-1]=0;return r_ancestors(path,FALSE);}
// Package-root ancestors cover the two EXEs; these additional fixed chains
// cover every intermediate ASAR/unpacked bridge directory without relookup.
static BOOL r_release_parents(void){return r_ancestors(RECOVERY_PACKAGE,FALSE)&&r_file_parents(RECOVERY_ASAR)&&r_file_parents(RECOVERY_BRIDGE);}
static BOOL r_changed(Held *file,BOOL directory){BY_HANDLE_FILE_INFORMATION after;BYTE hash[32];return !r_ordinary(file->handle,file->path,directory,&after)||!r_identity(&file->info,&after)||(!directory&&(after.nFileSizeLow!=file->info.nFileSizeLow||!r_equal(&after.ftLastWriteTime,&file->info.ftLastWriteTime,sizeof(FILETIME))||!r_hash(file->handle,hash)||!r_equal(hash,file->hash,32)));}
static void r_close(Held *file){if(file->handle&&file->handle!=INVALID_HANDLE_VALUE)CloseHandle(file->handle);file->handle=NULL;}
static void r_close_chain(void){for(DWORD i=0;i<chain_count;i++)r_close(&chain[i]);chain_count=0;if(private_sd)LocalFree(private_sd);private_sd=NULL;}
static BOOL r_read(Held *file,BYTE *bytes,DWORD cap,DWORD *length){LARGE_INTEGER start;start.QuadPart=0;DWORD got=0;if(file->info.nFileSizeLow>cap||!SetFilePointerEx(file->handle,start,NULL,FILE_BEGIN)||!ReadFile(file->handle,bytes,file->info.nFileSizeLow,&got,NULL)||got!=file->info.nFileSizeLow)return FALSE;*length=got;return TRUE;}
static BOOL r_write(HANDLE file,const void *bytes,DWORD count){DWORD wrote=0;LARGE_INTEGER start;start.QuadPart=0;return SetFilePointerEx(file,start,NULL,FILE_BEGIN)&&WriteFile(file,bytes,count,&wrote,NULL)&&wrote==count&&SetEndOfFile(file)&&FlushFileBuffers(file);}
static BOOL r_time(HANDLE process,FILETIME *created){FILETIME exited,kernel,user;return GetProcessTimes(process,created,&exited,&kernel,&user);}
static __attribute__((noinline)) BOOL r_process(HANDLE process,const WCHAR *expected,FILETIME *created){WCHAR name[R_PATH];DWORD length=R_PATH;return QueryFullProcessImageNameW(process,0,name,&length)&&lstrcmpiW(name,expected)==0&&r_time(process,created)&&WaitForSingleObject(process,0)==WAIT_TIMEOUT;}
static BOOL r_hex(const char *value,BYTE out[32]){if(lstrlenA(value)!=64)return FALSE;for(DWORD i=0;i<32;i++){BYTE b=0;for(DWORD j=0;j<2;j++){char c=value[2*i+j];if(c>='0'&&c<='9')b=(BYTE)(b*16+c-'0');else if(c>='a'&&c<='f')b=(BYTE)(b*16+c-'a'+10);else return FALSE;}out[i]=b;}return TRUE;}
static BOOL r_ascii_path(const char *value,const WCHAR *expected){for(DWORD i=0;;i++){if((BYTE)value[i]>127||(WCHAR)(BYTE)value[i]!=expected[i])return FALSE;if(!value[i])return TRUE;}}
static WCHAR r_upper(WCHAR c){return c>=L'a'&&c<=L'z'?c-32:c;}
static BOOL r_overlap(const WCHAR *a,const WCHAR *b){DWORD at=0;while(a[at]&&b[at]&&r_upper(a[at])==r_upper(b[at]))at++;return (!a[at]&&(!b[at]||b[at]==L'\\'))||(!b[at]&&(!a[at]||a[at]==L'\\'));}
static BOOL r_source_path(const char *value,WCHAR *out){DWORD length=(DWORD)lstrlenA(value);if(length<4||length>800||!((value[0]>='A'&&value[0]<='Z')||(value[0]>='a'&&value[0]<='z'))||value[1]!=':'||value[2]!='\\'||value[length-1]=='\\')return FALSE;
 DWORD start=3;for(DWORD i=0;i<=length;i++){BYTE c=(BYTE)value[i];if(c>126||(i>2&&((c&&c<32)||c==':'||c=='/'||c=='<'||c=='>'||c=='"'||c=='|'||c=='?'||c=='*')))return FALSE;out[i]=(WCHAR)c;if(i>=3&&(c=='\\'||c==0)){
  if(i==start||value[i-1]=='.'||value[i-1]==' ')return FALSE;DWORD base=0;while(start+base<i&&value[start+base]!='.')base++;WCHAR name[5];if(base<=4){for(DWORD j=0;j<base;j++)name[j]=r_upper((WCHAR)value[start+j]);name[base]=0;if(lstrcmpW(name,L"CON")==0||lstrcmpW(name,L"PRN")==0||lstrcmpW(name,L"AUX")==0||lstrcmpW(name,L"NUL")==0||(base==4&&((name[0]=='C'&&name[1]=='O'&&name[2]=='M')||(name[0]=='L'&&name[1]=='P'&&name[2]=='T'))&&name[3]>='1'&&name[3]<='9'))return FALSE;}start=i+1;
 }}return !r_overlap(out,RECOVERY_BASE)&&!r_overlap(out,RECOVERY_PACKAGE);
}
static void r_space(const BYTE *bytes,DWORD count,DWORD *at){while(*at<count&&(bytes[*at]==' '||bytes[*at]=='\n'||bytes[*at]=='\r'||bytes[*at]=='\t'))(*at)++;}
static BOOL r_string(const BYTE *bytes,DWORD count,DWORD *at,char *out,DWORD capacity){DWORD n=0;if(*at>=count||bytes[(*at)++]!='"')return FALSE;while(*at<count){BYTE c=bytes[(*at)++];if(c=='"'){out[n]=0;return TRUE;}if(c=='\\'){if(*at>=count)return FALSE;c=bytes[(*at)++];if(c!='\\'&&c!='"'&&c!='/')return FALSE;}if(c<32||c>126||n+1>=capacity)return FALSE;out[n++]=(char)c;}return FALSE;}
static BOOL r_descriptor(const BYTE *bytes,DWORD count,Descriptor *out){static const char *keys[15]={"mode","buildIdentity","sourceRoot","sourceSchema","sourceFormat","archiveExpectation","privateBase","exeSha256","asarSha256","bridgeSha256","bootstrapSha256","electron","node","napi","version"};DWORD at=0,mask=0;r_zero(out,sizeof(*out));r_space(bytes,count,&at);if(at>=count||bytes[at++]!='{')return FALSE;
 for(DWORD field=0;field<15;field++){char key[64];r_space(bytes,count,&at);if(!r_string(bytes,count,&at,key,sizeof(key)))return FALSE;DWORD index=15;for(DWORD i=0;i<15;i++)if(lstrcmpA(key,keys[i])==0)index=i;if(index==15||(mask&(1u<<index)))return FALSE;mask|=1u<<index;r_space(bytes,count,&at);if(at>=count||bytes[at++]!=':')return FALSE;r_space(bytes,count,&at);if(index==14){if(at>=count||bytes[at++]!='1')return FALSE;}else if(!r_string(bytes,count,&at,out->values[index],R_PATH))return FALSE;r_space(bytes,count,&at);if(at>=count||bytes[at++]!=(field==14?'}':','))return FALSE;
 }r_space(bytes,count,&at);if(at!=count||mask!=32767)return FALSE;
 if(lstrcmpA(out->values[0],"recovery-reader")||lstrcmpA(out->values[1],RECOVERY_BUILD_ID)||!r_source_path(out->values[2],out->source)||lstrcmpA(out->values[3],"v3")||!r_ascii_path(out->values[6],RECOVERY_BASE)||lstrcmpA(out->values[11],"44.4.3")||lstrcmpA(out->values[12],"24.21.0")||lstrcmpA(out->values[13],"10"))return FALSE;
 out->json=lstrcmpA(out->values[4],"json")==0;if(!out->json&&lstrcmpA(out->values[4],"sqlite"))return FALSE;out->archive_required=lstrcmpA(out->values[5],"present")==0;if(!out->archive_required&&lstrcmpA(out->values[5],"optional-at-epoch"))return FALSE;
 return r_hex(out->values[7],out->exe)&&r_hex(out->values[8],out->asar)&&r_hex(out->values[9],out->bridge)&&r_hex(out->values[10],out->bootstrap);
}
static DWORD r_remaining(ULONGLONG deadline){ULONGLONG now=GetTickCount64();return now>=deadline?0:(DWORD)(deadline-now);}
static BOOL r_io(HANDLE pipe,BOOL write,void *data,DWORD size,ULONGLONG deadline){
 OVERLAPPED *overlapped=HeapAlloc(GetProcessHeap(),HEAP_ZERO_MEMORY,sizeof(OVERLAPPED));if(!overlapped)return FALSE;overlapped->hEvent=CreateEventW(NULL,TRUE,FALSE,NULL);if(!overlapped->hEvent){HeapFree(GetProcessHeap(),0,overlapped);return FALSE;}
 DWORD count=0;BOOL ok=write?WriteFile(pipe,data,size,&count,overlapped):ReadFile(pipe,data,size,&count,overlapped);DWORD error=ok?0:GetLastError();
 if(!ok&&error==ERROR_IO_PENDING){DWORD remaining=r_remaining(deadline);ok=remaining&&WaitForSingleObject(overlapped->hEvent,remaining)==WAIT_OBJECT_0&&GetOverlappedResult(pipe,overlapped,&count,FALSE);}
 if(!ok&&error==ERROR_IO_PENDING){CancelIoEx(pipe,overlapped);/* Terminal failure: retain overlapped/event storage until process exit, so an asynchronous cancellation cannot use a freed stack object. */return FALSE;}
 CloseHandle(overlapped->hEvent);HeapFree(GetProcessHeap(),0,overlapped);return ok&&count==size;
}
#endif
