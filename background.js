// 插件安装或更新时
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Counterstrikle Helper 插件已安装/更新', details.reason);
  
  // 设置默认配置
  if (details.reason === 'install') {
    chrome.storage.local.set({
      autoPlay: false
    });
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('后台脚本收到消息:', message);
  
  if (message.action === 'getPlayerCount') {
    // 获取玩家数据并返回数量
    chrome.storage.local.get(['players'], (result) => {
      const count = result.players ? result.players.length : 0;
      sendResponse({ count: count });
    });
    return true; // 异步响应
  }
}); 