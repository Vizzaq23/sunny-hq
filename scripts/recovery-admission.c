#define BUILDING_NODE_EXTENSION
#define NAPI_VERSION 8
#include <node_api.h>
#include "recovery-native.h"
/* Fixed, typed host exports only. No resolver is exposed to JavaScript. */
#define NAPI_API_LIST(X) \
 X(napi_get_cb_info) X(napi_create_object) X(napi_create_function) \
 X(napi_set_named_property) X(napi_create_string_utf8) X(napi_create_string_utf16) \
 X(napi_create_buffer_copy) X(napi_throw_error) X(napi_add_env_cleanup_hook) \
 X(napi_type_tag_object) X(napi_object_freeze)
#define DECLARE(name) static __typeof__(&name) api_##name;
NAPI_API_LIST(DECLARE)
#undef DECLARE
static const napi_type_tag brand={0x8067aa51cee84564ULL,0x9d40882bd179e9a1ULL};
static LONG attempted;static Hello hello;static Admission admission;static Descriptor descriptor;static Held native_files[3],source_files[4];static DWORD source_count;static HANDLE completion_writer;
static BOOL snapshot_ready,archive_absent,cleanup_called;static DWORD parent_chain_index;static ULONGLONG archive_entry,archive_completion;
static BYTE *json_bytes,*archive_bytes;static DWORD json_length,archive_length;static DWORD archive_status;
static BOOL fixed_member(const WCHAR *member,WCHAR *path){return r_path(path,descriptor.source,member);}
static NTSTATUS relative_open(const WCHAR *member,HANDLE *handle){
 typedef NTSTATUS(NTAPI *OpenRelative)(PHANDLE,ACCESS_MASK,POBJECT_ATTRIBUTES,PIO_STATUS_BLOCK,PLARGE_INTEGER,ULONG,ULONG,ULONG,ULONG,PVOID,ULONG);
 OpenRelative open=(OpenRelative)GetProcAddress(GetModuleHandleW(L"ntdll.dll"),"NtCreateFile");if(!open)return (NTSTATUS)0xc0000002;
 UNICODE_STRING name;name.Buffer=(PWSTR)member;name.Length=(USHORT)(lstrlenW(member)*sizeof(WCHAR));name.MaximumLength=name.Length;OBJECT_ATTRIBUTES attributes;IO_STATUS_BLOCK result;r_zero(&attributes,sizeof(attributes));r_zero(&result,sizeof(result));attributes.Length=sizeof(attributes);attributes.RootDirectory=chain[parent_chain_index].handle;attributes.ObjectName=&name;attributes.Attributes=OBJ_CASE_INSENSITIVE;
 return open(handle,GENERIC_READ|READ_CONTROL|SYNCHRONIZE,&attributes,&result,NULL,FILE_ATTRIBUTE_NORMAL,FILE_SHARE_READ,FILE_OPEN,FILE_OPEN_REPARSE_POINT|FILE_SYNCHRONOUS_IO_NONALERT,NULL,0);
}
static BOOL parent_valid(void){DWORD flags=0;WCHAR filesystem[32];Held *parent=&chain[parent_chain_index];return !r_changed(parent,TRUE)&&GetFileInformationByHandleEx(parent->handle,(FILE_INFO_BY_HANDLE_CLASS)23,&flags,sizeof(flags))&&flags==0&&GetVolumeInformationByHandleW(parent->handle,NULL,0,NULL,NULL,NULL,filesystem,32)&&lstrcmpiW(filesystem,L"NTFS")==0;}
static BOOL retained_bytes(Held *file,BYTE **bytes,DWORD *length){if(!file->info.nFileSizeLow||file->info.nFileSizeLow>R_CAP)return FALSE;*bytes=HeapAlloc(GetProcessHeap(),0,file->info.nFileSizeLow);return *bytes&&r_read(file,*bytes,R_CAP,length);}
static __attribute__((noinline)) BOOL acquire_source(void){
 WCHAR drive[4]={descriptor.source[0],L':',L'\\',0};if(GetDriveTypeW(drive)!=DRIVE_FIXED)return FALSE;
 parent_chain_index=chain_count;if(!r_ancestors(descriptor.source,FALSE)||!parent_valid())return FALSE;
 HANDLE other=NULL;NTSTATUS status=relative_open(descriptor.json?L"sunny.sqlite":L"state.json",&other);if(status==0&&other)CloseHandle(other);if((DWORD)status!=0xc0000034)return FALSE;
 const WCHAR *names[3]={descriptor.json?L"state.json":L"sunny.sqlite",L"sunny.sqlite-wal",L"sunny.sqlite-shm"};DWORD count=descriptor.json?1:3;
 for(DWORD i=0;i<count;i++){WCHAR path[R_PATH];if(!fixed_member(names[i],path))return FALSE;source_count=i+1;if(!r_hold(&source_files[i],path,FALSE,FALSE)||!source_files[i].info.nFileSizeLow||source_files[i].info.nFileSizeLow>R_CAP||source_files[i].info.dwVolumeSerialNumber!=chain[parent_chain_index].info.dwVolumeSerialNumber)return FALSE;}
 // Full initial identity/metadata/hashes already exist, under all retained
 // handles, before the single archive name-resolution event E.
 if(descriptor.json&&!retained_bytes(&source_files[0],&json_bytes,&json_length))return FALSE;
 if(!parent_valid())return FALSE;HANDLE archive=NULL;archive_entry=GetTickCount64();status=relative_open(L"chatgpt-history.json",&archive);archive_completion=GetTickCount64();archive_status=(DWORD)status;
 if(archive_status==0xc0000034){if(descriptor.archive_required)return FALSE;archive_absent=TRUE;return TRUE;}
 if(status!=0)return FALSE;Held *file=&source_files[source_count++];file->handle=archive;if(!fixed_member(L"chatgpt-history.json",file->path)||!r_ordinary(file->handle,file->path,FALSE,&file->info)||!r_security(file->handle,FALSE)||file->info.dwVolumeSerialNumber!=chain[parent_chain_index].info.dwVolumeSerialNumber||!file->info.nFileSizeLow||file->info.nFileSizeLow>R_CAP||!r_hash(file->handle,file->hash)||!retained_bytes(file,&archive_bytes,&archive_length))return FALSE;
 return TRUE;
}
static void cleanup(void *ignored){(void)ignored;if(cleanup_called)return;cleanup_called=TRUE;
 BOOL unchanged=snapshot_ready&&source_count>0&&parent_valid();for(DWORD i=0;i<source_count;i++)if(!source_files[i].handle||source_files[i].handle==INVALID_HANDLE_VALUE||r_changed(&source_files[i],FALSE))unchanged=FALSE;for(DWORD i=0;i<chain_count;i++)if(r_changed(&chain[i],TRUE))unchanged=FALSE;
 Completion result;r_zero(&result,sizeof(result));result.magic=0x52444331;result.version=1;result.parent=admission.parent;result.child=admission.child;r_copy(&result.parent_created,&admission.parent_created,sizeof(FILETIME));r_copy(&result.child_created,&admission.child_created,sizeof(FILETIME));r_copy(result.generation,admission.generation,16);r_copy(result.descriptor_hash,admission.descriptor_hash,32);result.format=descriptor.json?1:2;result.count=source_count;result.compared=unchanged?1:0;result.complete=snapshot_ready?1:0;
 // This record certifies source comparison only. Bootstrap independently
 // requires successful actual child exit and an empty retained Job.
 BOOL recorded=completion_writer&&completion_writer!=INVALID_HANDLE_VALUE&&r_write(completion_writer,&result,sizeof(result));
 // Flush above precedes every source-handle disposal, even on failure.
 for(DWORD i=0;i<source_count;i++)r_close(&source_files[i]);for(DWORD i=0;i<3;i++)r_close(&native_files[i]);if(completion_writer&&completion_writer!=INVALID_HANDLE_VALUE)CloseHandle(completion_writer);completion_writer=NULL;if(json_bytes)HeapFree(GetProcessHeap(),0,json_bytes);if(archive_bytes)HeapFree(GetProcessHeap(),0,archive_bytes);json_bytes=NULL;archive_bytes=NULL;r_close_chain();
 // A complete cached record is insufficient when truncate or flush failed.
 // Force the actual exit after attempted receipt I/O and handle disposal.
 if(!recorded)ExitProcess(75);
}
static BOOL locator(WCHAR *name){DWORD n=GetEnvironmentVariableW(L"SUNNY_RECOVERY_PIPE",name,128);const WCHAR *prefix=L"\\\\.\\pipe\\SunnyRecovery-";DWORD prefix_length=(DWORD)lstrlenW(prefix);if(n!=prefix_length+32||n>=128)return FALSE;for(DWORD i=0;i<prefix_length;i++)if(name[i]!=prefix[i])return FALSE;for(DWORD i=prefix_length;i<n;i++)if(!((name[i]>=L'0'&&name[i]<=L'9')||(name[i]>=L'a'&&name[i]<=L'f')))return FALSE;return TRUE;}
static __attribute__((noinline)) BOOL handshake(void){WCHAR name[128];HANDLE pipe=INVALID_HANDLE_VALUE,parent=NULL;BOOL ok=FALSE;DWORD server=0,again=0;FILETIME parent_created,child_created;ULONGLONG deadline=GetTickCount64()+10000;
 if(!locator(name)||!r_user()||!r_release_parents()||!r_hold(&native_files[0],RECOVERY_BOOTSTRAP,FALSE,FALSE)||!r_hold(&native_files[1],RECOVERY_EXE,FALSE,FALSE)||!r_hold(&native_files[2],RECOVERY_BRIDGE,FALSE,FALSE))goto done;
 {const BYTE expected[32]=RECOVERY_BOOTSTRAP_HASH;if(!r_equal(expected,native_files[0].hash,32))goto done;}
 pipe=CreateFileW(name,GENERIC_READ|GENERIC_WRITE,0,NULL,OPEN_EXISTING,FILE_FLAG_OVERLAPPED,NULL);if(pipe==INVALID_HANDLE_VALUE)goto done;DWORD mode=PIPE_READMODE_MESSAGE;if(!SetNamedPipeHandleState(pipe,&mode,NULL,NULL)||!GetNamedPipeServerProcessId(pipe,&server))goto done;
 parent=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,server);if(!parent||!r_process(parent,RECOVERY_BOOTSTRAP,&parent_created)||!r_process(GetCurrentProcess(),RECOVERY_EXE,&child_created)||!GetNamedPipeServerProcessId(pipe,&again)||again!=server)goto done;
 r_zero(&hello,sizeof(hello));hello.magic=0x52444831;hello.version=1;hello.pid=GetCurrentProcessId();hello.created=child_created;hello.input=(UINT64)(UINT_PTR)GetStdHandle(STD_INPUT_HANDLE);hello.output=(UINT64)(UINT_PTR)GetStdHandle(STD_OUTPUT_HANDLE);hello.error=(UINT64)(UINT_PTR)GetStdHandle(STD_ERROR_HANDLE);
 if(!r_io(pipe,TRUE,&hello,sizeof(hello),deadline)||!r_io(pipe,FALSE,&admission,sizeof(admission),deadline))goto done;
 if(admission.magic!=0x52444131||admission.version!=1||admission.parent!=server||admission.child!=hello.pid||!r_equal(&admission.parent_created,&parent_created,sizeof(FILETIME))||!r_equal(&admission.child_created,&child_created,sizeof(FILETIME))||admission.descriptor_length<2||admission.descriptor_length>R_DESCRIPTOR||!GetNamedPipeServerProcessId(pipe,&again)||again!=server||WaitForSingleObject(parent,0)!=WAIT_TIMEOUT)goto done;
 BYTE digest[32];if(!r_hash_bytes(admission.descriptor,admission.descriptor_length,digest)||!r_equal(digest,admission.descriptor_hash,32)||!r_descriptor(admission.descriptor,admission.descriptor_length,&descriptor)||!r_equal(descriptor.bootstrap,native_files[0].hash,32)||!r_equal(descriptor.exe,native_files[1].hash,32)||!r_equal(descriptor.bridge,native_files[2].hash,32))goto done;
 // Bind the generation to the locator, not merely a returned arbitrary path.
 {WCHAR expected[R_PATH],member[35]=L"g-";DWORD prefix=(DWORD)lstrlenW(L"\\\\.\\pipe\\SunnyRecovery-");for(DWORD i=0;i<32;i++)member[2+i]=name[prefix+i];member[34]=0;if(!r_path(expected,RECOVERY_BASE,member)||lstrcmpW(expected,admission.runtime))goto done;const WCHAR *hex=L"0123456789abcdef";for(DWORD i=0;i<16;i++)if(member[2+i*2]!=hex[admission.generation[i]>>4]||member[3+i*2]!=hex[admission.generation[i]&15])goto done;}
 ok=TRUE;
done:if(pipe!=INVALID_HANDLE_VALUE)CloseHandle(pipe);if(parent)CloseHandle(parent);return ok;}
static __attribute__((noinline)) BOOL completion_open(void){WCHAR path[R_PATH];BY_HANDLE_FILE_INFORMATION info;if(!r_ancestors(admission.runtime,TRUE)||!r_path(path,admission.runtime,L"completion.private.bin"))return FALSE;completion_writer=CreateFileW(path,GENERIC_WRITE|READ_CONTROL,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);return completion_writer!=INVALID_HANDLE_VALUE&&r_ordinary(completion_writer,path,FALSE,&info)&&r_identity(&info,&admission.completion)&&info.nFileSizeLow==0&&r_security(completion_writer,TRUE);}
static BOOL string(napi_env env,napi_value object,const char *key,const char *value){napi_value text;return api_napi_create_string_utf8(env,value,NAPI_AUTO_LENGTH,&text)==napi_ok&&api_napi_set_named_property(env,object,key,text)==napi_ok;}
static BOOL wide(napi_env env,napi_value object,const char *key,const WCHAR *value){napi_value text;return api_napi_create_string_utf16(env,(const char16_t *)value,NAPI_AUTO_LENGTH,&text)==napi_ok&&api_napi_set_named_property(env,object,key,text)==napi_ok;}
static BOOL buffer(napi_env env,napi_value object,const char *key,const BYTE *bytes,DWORD count){napi_value value;return api_napi_create_buffer_copy(env,count,bytes,NULL,&value)==napi_ok&&api_napi_set_named_property(env,object,key,value)==napi_ok;}
static napi_value consume(napi_env env,napi_callback_info info){size_t argc=1;napi_value ignored,result=NULL;if(InterlockedCompareExchange(&attempted,1,0)!=0||api_napi_get_cb_info(env,info,&argc,&ignored,NULL,NULL)!=napi_ok||argc!=0)goto denied;
 if(api_napi_add_env_cleanup_hook(env,cleanup,NULL)!=napi_ok||!handshake())goto denied;
 // The live exchange is terminal before the first source acquisition.
 if(!completion_open()||!acquire_source())goto denied;snapshot_ready=TRUE;
 if(api_napi_create_object(env,&result)!=napi_ok||api_napi_type_tag_object(env,result,&brand)!=napi_ok||!string(env,result,"sourceFormat",descriptor.json?"json":"sqlite")||!string(env,result,"archiveStatus",archive_absent?"absent-at-epoch":"present-verified")||!string(env,result,"buildIdentity",RECOVERY_BUILD_ID)||!wide(env,result,"runtimeDir",admission.runtime))goto denied;
 char epoch[33];const char *hex="0123456789abcdef";for(DWORD i=0;i<16;i++){epoch[2*i]=hex[admission.generation[i]>>4];epoch[2*i+1]=hex[admission.generation[i]&15];}epoch[32]=0;if(!string(env,result,"epoch",epoch)||!buffer(env,result,"descriptorBytes",admission.descriptor,admission.descriptor_length))goto denied;
 if(descriptor.json){if(!buffer(env,result,"raw",json_bytes,json_length))goto denied;}else{WCHAR path[R_PATH];if(!fixed_member(L"sunny.sqlite",path)||!wide(env,result,"sqlitePath",path))goto denied;}
 if(!archive_absent&&!buffer(env,result,"archiveBytes",archive_bytes,archive_length))goto denied;
 if(api_napi_object_freeze(env,result)!=napi_ok)goto denied;return result;
denied:api_napi_throw_error(env,"RECOVERY_LAUNCH_NOT_ADMITTED","RECOVERY_LAUNCH_NOT_ADMITTED");return NULL;}
NAPI_MODULE_INIT(){HMODULE host=GetModuleHandleW(NULL);WCHAR path[R_PATH];DWORD n=GetModuleFileNameW(host,path,R_PATH);if(!host||!n||n>=R_PATH||lstrcmpiW(path,RECOVERY_EXE))return NULL;
#define LOAD(name) api_##name=(__typeof__(&name))GetProcAddress(host,#name);if(!api_##name)return NULL;
 NAPI_API_LIST(LOAD)
#undef LOAD
 napi_value function;if(api_napi_create_function(env,"consumeRecoveryLaunch",NAPI_AUTO_LENGTH,consume,NULL,&function)!=napi_ok||api_napi_set_named_property(env,exports,"consumeRecoveryLaunch",function)!=napi_ok||api_napi_object_freeze(env,exports)!=napi_ok)return NULL;return exports;
}
