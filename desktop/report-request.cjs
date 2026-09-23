function validateReportRequest(args){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['projectIds','since','until'].includes(key)))throw Error('Invalid report scope.');
 let size;try{size=JSON.stringify(args).length;}catch{throw Error('Invalid report scope.');}
 if(size>4000)throw Error('Invalid report scope.');
 if(args.projectIds!==undefined&&(!Array.isArray(args.projectIds)||args.projectIds.length>100||args.projectIds.some(id=>typeof id!=='string'||!id||id.length>200)))throw Error('Invalid report scope.');
 if(['since','until'].some(key=>args[key]!==undefined&&(!Number.isSafeInteger(args[key])||args[key]<0)))throw Error('Invalid report scope.');
 return args;
}
module.exports={validateReportRequest};
