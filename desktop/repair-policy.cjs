// Exhaustion is durable and monotonic; phase and later grants cannot reset it.
function repairExhausted(run){return !Number.isSafeInteger(run?.counters?.repairs)||!Number.isSafeInteger(run?.grant?.maxRepairs)||run.repairExhausted===true||run.counters.repairs>=Math.min(3,run.grant.maxRepairs);}
module.exports={repairExhausted};

