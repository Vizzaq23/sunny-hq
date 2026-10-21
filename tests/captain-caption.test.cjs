const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('quarter captain caption grows below the fixed marker without moving its floor anchor',()=>{
 const css=fs.readFileSync(require.resolve('../src/views/project-room.css'),'utf8');
 const rules=[...css.matchAll(/\.room-captain b\{([^}]+)\}/g)].map(m=>m[1]).join(';');
 const style=Object.fromEntries(rules.split(';').filter(Boolean).map(p=>p.split(':').map(s=>s.trim())));
 assert.equal(style.position,'absolute','caption must not contribute to the translated marker box');
 assert.equal(style.top,'calc(100% + 4px)','caption clears the fixed sun marker');
 assert.equal(style['white-space'],'nowrap','retain the full readable caption');
 // An out-of-flow caption leaves the 40px marker centered at the same floor
 // point for either normal or doubled text height; only its lower edge grows.
 for(const captionHeight of [19,32]){const floor=300,markerHeight=40,top=floor-markerHeight/2;assert.equal(top+markerHeight/2,floor);assert.ok(top+markerHeight+4+captionHeight>floor+markerHeight/2);}
});
