// Abruptly end this disposable child without Hub.close() at a real storage boundary.
const fs=require('node:fs'),path=require('node:path');
const {Hub}=require('../../desktop/hub.cjs');
const {StateStore,SqliteStore}=require('../../desktop/core.cjs');
const [root,phase,backend]=process.argv.slice(2),store=backend==='sqlite'?new SqliteStore(path.join(root,'state.sqlite')):new StateStore(path.join(root,'state.json'));
const save=store.save.bind(store);
store.save=value=>{save(value);const record=value.resultSaves?.[0];if(record&&(phase==='before-write'&&record.status==='saving'||phase==='after-receipt'&&record.status==='saved'))process.exit(73);};
const flush=fs.fsyncSync;
fs.fsyncSync=fd=>{flush(fd);if(phase==='after-note')process.exit(73);};
const hub=new Hub({home:root,store,catalog:{discoverProjects:()=>[],discoverTools:()=>[],discoverAutomations:()=>[],vaultPath:()=>path.join(root,'vault')}});
hub.resultSaves.save({taskId:'task-result',messageId:'reply-1',title:'Reviewed report',text:'# Status\nReviewed by the captain.',reviewed:true});
throw Error('Fixture did not reach the requested crash boundary');
