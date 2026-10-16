// Immutable inputs for the four private, finite native journeys.
const alpha=epoch=>`module.exports=()=>${41+epoch};\n`;
const beta=epoch=>`module.exports=name=>'Hello '+name+'${epoch===2?' again':''}';\n`;
const initial={
 'package.json':JSON.stringify({private:true,scripts:{test:'node check.cjs',build:'node build.cjs'}})+'\n',
 '.gitignore':'out/\n.sunny-results/\n',
 'src/alpha.cjs':'module.exports=()=>0;\n',
 'src/beta.cjs':"module.exports=()=>'';\n",
 'check.cjs':"const a=require('node:assert/strict'),n=require('./src/alpha.cjs')(),g=require('./src/beta.cjs')('crew');a.ok(n===42||n===43);a.equal(g,n===42?'Hello crew':'Hello crew again');\n",
 'build.cjs':"const fs=require('node:fs');require('./check.cjs');fs.mkdirSync('out',{recursive:true});const greeting=require('./src/beta.cjs')('crew'),step=require('./src/alpha.cjs')()-41;fs.writeFileSync('out/index.html','<!doctype html><meta charset=utf-8><title>Sunny counter</title><h1>'+greeting+'</h1><button id=advance>Advance</button><output id=count>0</output><script src=\"fixture.js\"></script>');fs.writeFileSync('out/fixture.js','document.querySelector(\"#advance\").addEventListener(\"click\",()=>{const count=document.querySelector(\"#count\");count.textContent=String(Number(count.textContent)+'+step+');fetch(\"/__interact\",{method:\"POST\"})});');\n",
 'playable.json':JSON.stringify({version:1,runtime:'node-http',buildScript:'build',outputDir:'out',entrypoint:'index.html',assets:['index.html','fixture.js'],limitations:['Private offline counter; no external services']})+'\n'
};
module.exports={initial:Object.freeze(initial),alpha,beta};
