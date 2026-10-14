function createBackup(hub){
 return {version:1,missionBook:hub.missionBook.data,news:hub.state.news,world:hub.state.world,exportedAt:new Date().toISOString(),projects:hub.state.projects,tasks:hub.state.tasks,settings:hub.state.settings,growth:hub.growth.data,discussions:hub.state.discussions,resultSaves:hub.state.resultSaves};
}
module.exports={createBackup};
