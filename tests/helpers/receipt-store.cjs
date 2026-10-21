const { createHash, randomUUID } = require('node:crypto');
function receiptStore(store) {
 const epoch = randomUUID(); let sequence = 0, lastReceipt = null;
 async function commit(image) {
  const stateSha256 = createHash('sha256').update(JSON.stringify(image)).digest('hex');
  await store.save(image);
  return lastReceipt = { epoch, sequence: ++sequence, stateSha256, durableAt: Date.now() };
 }
 store.barrier = async (image, _reason) => commit(image);
 store.checkpoint = async image => commit(image);
 store.flush = async () => lastReceipt;
 const close = store.close;
 store.close = async () => { await close?.call(store); };
 return store;
}
module.exports = { receiptStore };
