/**
 * Counterstrikle Helper 内容脚本
 * 处理页面交互和游戏逻辑
 */

// 状态管理
const GameState = {
  // 玩家数据
  allPlayers: [],
  currentCandidates: [],
  lastGuess: null,
  
  // 游戏状态
  autoPlayEnabled: false,
  guessCount: 0,
  gamePhase: null,
  
  // WebSocket 相关
  activeSocket: null,
  connectionId: "",
  
  // 算法模块引用
  algorithm: null,
  neuralAlgorithm: null,
  
  // 算法设置
  algorithmType: 'entropy', // 默认使用信息熵算法
  
  // 神经网络状态
  guessHistory: [], // 存储猜测历史用于训练
  
  // 猜测设置
  guessInterval: 5000, // 默认5秒
  
  // 重置游戏
  reset() {
    this.currentCandidates = [...this.allPlayers];
    this.lastGuess = null;
    this.guessCount = 0;
    console.log('游戏状态已重置，候选人数量:', this.currentCandidates.length);
  }
};

// 初始化函数
async function initialize() {
  console.log('Counterstrikle Helper 插件已加载');
  
  try {
    // 初始化变量
    window.intervalsCleared = false;
    window.lastBroadcastError = null;
    
    // 加载算法模块
    await loadAlgorithmModules();
    
    // 加载设置和选手数据
    await loadSettingsAndPlayers();
    
    // 预加载TensorFlow.js到页面环境
    try {
      await loadTensorFlowIntoPage();
      console.log('TensorFlow.js预加载成功');
    } catch (err) {
      // 错误处理，但不影响主要功能
      console.warn('TensorFlow.js预加载失败，但这不会影响基本功能:', err.message);
    }
    
    // 设置 WebSocket 拦截
    setupWebSocketInterception();
    
    // 设置消息监听
    setupMessageListeners();
    
    // 初始化游戏状态
    initializeGameState();
    
    // 设置状态广播
    setupStatusBroadcast();
    
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

/**
 * 加载算法模块
 */
async function loadAlgorithmModules() {
  try {
    // 加载常规算法模块
    await loadEntropyAlgorithm();
    
    // 加载神经网络算法模块
    await loadNeuralAlgorithm();
    
    // 根据设置选择当前使用的算法
    await selectCurrentAlgorithm();
    
    console.log('所有算法模块加载完成');
  } catch (error) {
    console.error('加载算法模块失败:', error);
    throw error;
  }
}

/**
 * 加载信息熵算法模块
 */
async function loadEntropyAlgorithm() {
  try {
    const algorithmUrl = chrome.runtime.getURL('algorithm.js');
    
    try {
      // 优先使用动态 import
      const algorithmModule = await import(algorithmUrl);
      GameState.algorithm = algorithmModule.default;
      console.log('成功通过 import 加载信息熵算法模块');
    } catch (importError) {
      console.error('通过 import 加载信息熵算法模块失败:', importError);
      
      // 回退方案 - 使用 script 标签加载
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = algorithmUrl;
        script.type = 'module';
        script.onload = () => {
          if (window.AlgorithmModule) {
            GameState.algorithm = window.AlgorithmModule;
            console.log('成功通过 script 标签加载信息熵算法模块');
            resolve();
          } else {
            const error = new Error('信息熵算法模块加载后未找到算法对象');
            console.error(error);
            reject(error);
          }
        };
        script.onerror = (err) => {
          console.error('通过 script 标签加载信息熵算法模块失败:', err);
          reject(err);
        };
        document.head.appendChild(script);
      });
    }
  } catch (error) {
    console.error('加载信息熵算法模块失败:', error);
    throw error;
  }
}

/**
 * 加载神经网络算法模块
 */
async function loadNeuralAlgorithm() {
  try {
    const neuralAlgorithmUrl = chrome.runtime.getURL('neural-algorithm.js');
    
    try {
      // 优先使用动态 import
      const neuralModule = await import(neuralAlgorithmUrl);
      GameState.neuralAlgorithm = neuralModule.default;
      console.log('成功通过 import 加载神经网络算法模块');
    } catch (importError) {
      console.error('通过 import 加载神经网络算法模块失败:', importError);
      
      // 回退方案 - 使用 script 标签加载
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = neuralAlgorithmUrl;
        script.type = 'module';
        script.onload = () => {
          if (window.NeuralAlgorithmModule) {
            GameState.neuralAlgorithm = window.NeuralAlgorithmModule;
            console.log('成功通过 script 标签加载神经网络算法模块');
            resolve();
          } else {
            const error = new Error('神经网络算法模块加载后未找到算法对象');
            console.error(error);
            reject(error);
          }
        };
        script.onerror = (err) => {
          console.error('通过 script 标签加载神经网络算法模块失败:', err);
          reject(err);
        };
        document.head.appendChild(script);
      });
    }
  } catch (error) {
    console.error('加载神经网络算法模块失败:', error);
    // 神经网络算法是可选的，加载失败不抛出异常
  }
}

/**
 * 根据设置选择当前使用的算法
 */
async function selectCurrentAlgorithm() {
  // 获取存储的算法类型
  try {
    const settings = await chrome.storage.local.get(['algorithmType']);
    if (settings.algorithmType) {
      GameState.algorithmType = settings.algorithmType;
    }
    
    console.log('当前选择的算法类型:', GameState.algorithmType);
  } catch (error) {
    console.error('加载算法类型设置失败:', error);
  }
}

/**
 * 获取当前使用的算法实例
 * @returns {Object} - 当前算法实例
 */
function getCurrentAlgorithm() {
  if (GameState.algorithmType === 'neural' && GameState.neuralAlgorithm) {
    return GameState.neuralAlgorithm;
  }
  return GameState.algorithm;
}

/**
 * 加载设置和选手数据
 */
async function loadSettingsAndPlayers() {
  try {
    // 从存储中加载设置
    const settings = await chrome.storage.local.get(['autoPlay', 'players', 'guessInterval', 'algorithmType', 'guessHistory']);
    GameState.autoPlayEnabled = settings.autoPlay || false;
    GameState.guessInterval = settings.guessInterval || 5000;
    GameState.algorithmType = settings.algorithmType || 'entropy';
    GameState.guessHistory = settings.guessHistory || [];
    
    console.log('从存储加载自动模式设置:', GameState.autoPlayEnabled);
    console.log('从存储加载猜测间隔:', GameState.guessInterval);
    console.log('从存储加载算法类型:', GameState.algorithmType);
    console.log('从存储加载猜测历史数量:', GameState.guessHistory.length);
    
    if (settings.players) {
      GameState.allPlayers = settings.players;
      console.log(`从缓存加载了 ${GameState.allPlayers.length} 名选手数据`);
    } else {
      // 加载选手数据
      await loadPlayersData();
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    // 尝试直接加载选手数据
    await loadPlayersData();
  }
}

// 加载选手数据
async function loadPlayersData() {
  try {
    const response = await fetch(chrome.runtime.getURL('players.json'));
    GameState.allPlayers = await response.json();
    console.log(`成功加载了 ${GameState.allPlayers.length} 名选手数据`);
    
    // 缓存到存储中
    await chrome.storage.local.set({ players: GameState.allPlayers });
  } catch (error) {
    console.error('加载选手数据失败:', error);
  }
}

/**
 * 设置 WebSocket 拦截
 */
function setupWebSocketInterception() {
  console.log('开始设置WebSocket监听器...');
  
  // 注入页面脚本
  injectPageScript();
  
  // 定期检查WebSocket连接状态
  setInterval(() => {
    if (!GameState.activeSocket) {
      console.log('等待WebSocket连接...');
    }
  }, 10000);
  
  console.log('WebSocket监听器设置完成');
}

/**
 * 设置消息监听
 */
function setupMessageListeners() {
  try {
    // 移除可能存在的旧监听器，避免重复
    chrome.runtime.onMessage.removeListener(handleMessage);
    // 添加新监听器
    chrome.runtime.onMessage.addListener(handleMessage);
    console.log('消息监听器设置完成');
  } catch (error) {
    console.error('设置消息监听器失败:', error);
    // 如果是扩展上下文失效，清理资源
    if (error.message && error.message.includes('Extension context invalidated')) {
      clearAllIntervals();
      return false; // 监听器设置失败
    }
  }
  return true; // 监听器设置成功
}

/**
 * 初始化游戏状态
 */
function initializeGameState() {
  if (!GameState.gamePhase) {
    GameState.gamePhase = 'game';
    console.log('初始化游戏状态为game');
    
    // 初始化候选列表
    if (GameState.currentCandidates.length === 0) {
      GameState.currentCandidates = [...GameState.allPlayers];
      GameState.guessCount = 0;
      console.log('初始化候选列表，候选人数量:', GameState.currentCandidates.length);
    } else {
      console.log('候选列表已存在，跳过初始化，候选人数量:', GameState.currentCandidates.length);
    }
    
    // 尝试第一次猜测
    console.log('初始化完成，尝试第一次猜测');
    setTimeout(() => tryFirstGuess(), 2000);
  } else {
    console.log('游戏状态已存在:', GameState.gamePhase, '跳过初始化');
    
    // 即使游戏状态已存在，仍然尝试第一次猜测
    if (GameState.gamePhase === 'game' && GameState.guessCount === 0) {
      console.log('游戏已经在进行中，尝试第一次猜测');
      setTimeout(() => tryFirstGuess(), 2000);
    }
  }
}

/**
 * 设置状态广播
 */
function setupStatusBroadcast() {
  try {
    // 确保之前的定时器已被清除
    if (window.statusInterval) {
      clearInterval(window.statusInterval);
    }
    // 保存定时器引用
    window.statusInterval = setInterval(broadcastStatus, 1000);
    console.log('已设置状态广播定时器');
    
    // 主动广播一次状态
    setTimeout(broadcastStatus, 500);
  } catch (error) {
    console.error('设置状态广播定时器失败:', error);
    return false;
  }
  return true;
}

// 注入页面脚本
function injectPageScript() {
  try {
    console.log('尝试注入页面脚本...');
    
    // 使用扩展文件而不是内联脚本，避免CSP限制
    const scriptUrl = chrome.runtime.getURL('websocket-interceptor.js');
    
    // 创建script元素并设置src属性
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.type = 'text/javascript';
    script.onload = function() {
      console.log('WebSocket拦截器脚本加载成功');
      // 脚本加载后，将其移除，不影响页面
      this.remove();
    };
    script.onerror = function(error) {
      console.error('WebSocket拦截器脚本加载失败:', error);
    };
    
    // 添加到页面
    (document.head || document.documentElement).appendChild(script);
    
    // 监听WebSocket发送数据事件
    window.addEventListener('webSocketSend', (e) => {
      console.log('监听到WebSocket发送数据');
      try {
        if (typeof e.detail.data === 'string') {
          handleOutgoingWebSocketMessage(null, e.detail.data);
        }
      } catch(err) {
        console.error('处理WebSocket发送事件出错:', err);
      }
    });
    
    // 监听WebSocket接收消息事件
    window.addEventListener('webSocketMessage', (e) => {
      console.log('监听到WebSocket接收消息');
      try {
        if (typeof e.detail.data === 'string') {
          const fakeEvent = { data: e.detail.data };
          handleIncomingWebSocketMessage(fakeEvent);
        }
      } catch(err) {
        console.error('处理WebSocket消息事件出错:', err);
      }
    });
    
    // 监听WebSocket状态事件
    window.addEventListener('webSocketStatus', (e) => {
      console.log('WebSocket状态更新:', e.detail);
      // 如果WebSocket已打开，设置activeSocket为true
      GameState.activeSocket = e.detail && e.detail.active;
    });
    
    // 监听猜测发送结果事件
    window.addEventListener('guessSent', (e) => {
      console.log('猜测发送结果:', e.detail);
    });
    
    console.log('页面脚本注入完成，等待WebSocket活动...');
  } catch (error) {
    console.error('注入页面脚本出错:', error);
  }
}

// 处理发出的WebSocket消息
function handleOutgoingWebSocketMessage(socket, data) {
  try {
    const message = JSON.parse(data);
    console.log('WebSocket 发送消息:', message);
    
    // 检查是否是猜测消息
    if (message.type === 'GUESS') {
      // 保存猜测的选手ID以便后续处理
      const playerId = message.payload?.playerId;
      if (playerId) {
        GameState.lastGuess = GameState.allPlayers.find(p => p.id === playerId);
        console.log('猜测选手:', GameState.lastGuess ? GameState.lastGuess.nickname : '未知选手ID: ' + playerId);
        
        // 如果找不到选手ID，尝试在日志中输出可用的ID列表
        if (!GameState.lastGuess) {
          console.log('可用选手ID列表:');
          GameState.allPlayers.slice(0, 5).forEach(p => {
            console.log(`- ${p.nickname}: ${p.id}`);
          });
          console.log(`... 及其他 ${GameState.allPlayers.length - 5} 名选手`);
        }
      } else {
        console.log('猜测消息中没有找到playerID:', message);
      }
    }
  } catch (error) {
    console.log('非JSON WebSocket消息或解析错误:', data, error);
  }
}

// 处理接收到的WebSocket消息
function handleIncomingWebSocketMessage(event) {
  try {
    console.log('收到WebSocket消息:', event.data.substring(0, 150) + (event.data.length > 150 ? '...' : ''));
    const message = JSON.parse(event.data);
    
    // 判断消息类型
    // blast.tv上可能使用不同的消息结构
    if (message.phase) {
      // 原始网站格式
      GameState.gamePhase = message.phase;
      console.log('检测到游戏阶段:', GameState.gamePhase);
      handleGameStateChange(GameState.gamePhase);
    } else if (message.type === 'GAME_STATE') {
      // blast.tv可能的格式
      GameState.gamePhase = message.payload?.state || 'game';
      console.log('检测到blast.tv游戏状态:', GameState.gamePhase);
      handleGameStateChange(GameState.gamePhase);
    } else if (message.type === 'GUESS_RESPONSE' || message.type === 'GUESS_FEEDBACK') {
      // 可能的猜测响应格式
      console.log('收到猜测响应:', message);
      handleGuessResponse(message);
    }
    
    // 检查是否有猜测反馈
    if (GameState.gamePhase === 'game' && GameState.lastGuess && GameState.autoPlayEnabled && GameState.algorithm) {
      const feedback = extractFeedbackFromResponse(message);
      
      if (feedback) {
        // 处理反馈并准备下一次猜测
        processFeedbackAndGuess(feedback);
      }
    }
  } catch (error) {
    console.log('处理WebSocket消息错误:', error);
  }
}

// 处理游戏状态变化
function handleGameStateChange(phase) {
  console.log('游戏状态变更为:', phase, '当前自动模式:', GameState.autoPlayEnabled, '当前猜测次数:', GameState.guessCount);
  
  // 如果游戏刚开始，重置状态
  if (phase === 'game' && (!GameState.currentCandidates || GameState.currentCandidates.length === 0)) {
    console.log('游戏开始，初始化候选列表');
    GameState.currentCandidates = [...GameState.allPlayers];
    GameState.guessCount = 0;
    console.log('重置后候选人数量:', GameState.currentCandidates.length);
    
    // 尝试第一次猜测
    tryFirstGuess();
  } else if (phase === 'results' || phase === 'lobby' || phase === 'end') {
    // 游戏结束，重置状态
    console.log('游戏结束或在大厅中，重置状态');
    GameState.reset();
  } else if (phase === 'game') {
    console.log('游戏进行中，当前候选人数量:', GameState.currentCandidates ? GameState.currentCandidates.length : 0);
    
    // 游戏进行中，尝试第一次猜测
    tryFirstGuess();
  }
  
  // 广播状态更新
  broadcastStatus();
}

// 处理猜测响应
function handleGuessResponse(response) {
  if (!GameState.lastGuess) {
    console.log('收到猜测响应，但没有上一次猜测记录');
    return;
  }
  
  try {
    // 尝试从blast.tv格式提取反馈
    let feedback = null;
    
    // 提取反馈信息
    if (response.payload) {
      feedback = {
        playerId: GameState.lastGuess.id,
        isSuccess: response.payload.isCorrect === true,
        feedback: {}
      };
      
      // 提取各属性的反馈
      // 这里需要根据blast.tv的实际响应格式进行调整
      const feedbackData = response.payload.feedback || {};
      
      for (const attr of GameState.algorithm.ATTRIBUTES_TO_COMPARE) {
        if (feedbackData[attr]) {
          feedback.feedback[attr] = feedbackData[attr];
        } else if (attr === 'nationality' && feedbackData.country) {
          feedback.feedback[attr] = feedbackData.country;
        } else if (attr === 'age' && feedbackData.age) {
          feedback.feedback[attr] = feedbackData.age;
        } else if (attr === 'majorAppearances' && feedbackData.majors) {
          feedback.feedback[attr] = feedbackData.majors;
        } else if (attr === 'team' && feedbackData.team) {
          feedback.feedback[attr] = feedbackData.team;
        } else if (attr === 'role' && feedbackData.role) {
          feedback.feedback[attr] = feedbackData.role;
        } else if (attr === 'region' && feedbackData.region) {
          feedback.feedback[attr] = feedbackData.region;
        }
      }
      
      // 处理反馈
      if (Object.keys(feedback.feedback).length > 0) {
        console.log('从响应提取到反馈:', feedback);
        processFeedbackAndGuess(feedback);
      }
    }
  } catch (error) {
    console.error('处理猜测响应出错:', error);
  }
}

// 处理反馈并生成下一次猜测
function processFeedbackAndGuess(feedback) {
  console.log('收到反馈:', feedback);
  
  // 检查猜测是否成功
  if (feedback.isSuccess) {
    console.log('猜测成功！游戏结束');
    return;
  }
  
  // 将游戏反馈转换为算法可用的格式
  const internalFeedback = GameState.algorithm.processGameFeedback(feedback, GameState.algorithm.ATTRIBUTES_TO_COMPARE);
  
  if (!internalFeedback) {
    console.error('无法处理反馈');
    return;
  }
  
  console.log('处理后的反馈:', internalFeedback);
  
  // 根据反馈过滤候选人
  GameState.currentCandidates = GameState.algorithm.filterCandidates(
    GameState.currentCandidates, 
    GameState.lastGuess, 
    internalFeedback, 
    GameState.algorithm.ATTRIBUTES_TO_COMPARE
  );
  
  console.log(`根据反馈过滤后剩余候选人: ${GameState.currentCandidates.length}`);
  
  // 检查是否还有候选人
  if (GameState.currentCandidates.length === 0) {
    console.error('过滤后没有候选人，算法可能有问题');
    return;
  }
  
  // 自动进行下一次猜测（使用自定义间隔时间）
  if (GameState.autoPlayEnabled) {
    // 根据间隔决定下一次猜测的方式
    if (GameState.guessInterval <= 0) {
      // 间隔为0时立即猜测
      console.log('间隔为0，立即进行下一次猜测');
      makeNextGuess();
    } else {
      // 有间隔时使用setTimeout
      console.log(`将在 ${GameState.guessInterval}ms 后进行下一次猜测`);
      setTimeout(() => {
        makeNextGuess();
      }, GameState.guessInterval);
    }
  }
}

// 进行下一次猜测
function makeNextGuess() {
  console.log('尝试进行猜测，条件检查:');
  console.log('- 自动模式:', GameState.autoPlayEnabled);
  console.log('- WebSocket连接:', !!GameState.activeSocket);
  console.log('- 候选人数量:', GameState.currentCandidates ? GameState.currentCandidates.length : 0);
  console.log('- 算法模块:', !!GameState.algorithm);
  
  if (!GameState.autoPlayEnabled) {
    console.log('自动模式未开启，取消猜测');
    return;
  }
  
  if (!GameState.activeSocket) {
    console.log('WebSocket连接不可用，取消猜测');
    return;
  }
  
  if (!GameState.currentCandidates || GameState.currentCandidates.length === 0) {
    console.log('没有可用的候选人，取消猜测');
    return;
  }
  
  if (!GameState.algorithm) {
    console.log('算法模块未加载，取消猜测');
    return;
  }
  
  // 找到最佳猜测
  console.log('开始计算最佳猜测...');
  const bestGuess = GameState.algorithm.findBestGuess(GameState.currentCandidates, GameState.allPlayers, GameState.algorithm.ATTRIBUTES_TO_COMPARE);
  
  if (!bestGuess) {
    console.error('无法确定最佳猜测');
    return;
  }
  
  GameState.guessCount++;
  console.log(`第 ${GameState.guessCount} 次猜测:`, bestGuess.nickname);
  
  // 发送猜测
  const guessMessage = {
    type: "GUESS",
    payload: {
      playerId: bestGuess.id,
      connectionId: GameState.connectionId
    }
  };
  
  GameState.lastGuess = bestGuess;
  
  // 使用自定义事件发送消息到页面脚本
  try {
    const jsonMessage = JSON.stringify(guessMessage);
    // 通过事件通知页面脚本发送猜测
    window.dispatchEvent(new CustomEvent('sendGuess', {
      detail: { message: jsonMessage }
    }));
    
    console.log('猜测请求已发送到页面脚本');
  } catch (err) {
    console.error('发送猜测消息失败:', err);
  }
}

// 重置游戏状态
function resetGameState() {
  GameState.currentCandidates = [];
  GameState.lastGuess = null;
  GameState.guessCount = 0;
  console.log('游戏状态已重置');
}

// 处理来自弹出窗口的消息
function handleMessage(message, sender, sendResponse) {
  console.log('收到消息:', message);
  
  if (message.action === 'toggleAutoPlay') {
    const previousAutoPlay = GameState.autoPlayEnabled;
    GameState.autoPlayEnabled = message.value;
    chrome.storage.local.set({ autoPlay: GameState.autoPlayEnabled });
    console.log('自动玩模式切换:', previousAutoPlay, '->', GameState.autoPlayEnabled);
    
    // 如果启用了自动模式且游戏正在进行，尝试开始第一次猜测
    if (GameState.autoPlayEnabled && !previousAutoPlay && GameState.gamePhase === 'game') {
      console.log('自动模式刚刚开启，检查是否可以进行第一次猜测');
      tryFirstGuess();
    }
  } else if (message.action === 'setGuessInterval') {
    const previousInterval = GameState.guessInterval;
    GameState.guessInterval = message.value;
    chrome.storage.local.set({ guessInterval: GameState.guessInterval });
    console.log('猜测间隔已更新:', previousInterval, '->', GameState.guessInterval);
  } else if (message.action === 'setAlgorithmType') {
    const previousType = GameState.algorithmType;
    GameState.algorithmType = message.value;
    chrome.storage.local.set({ algorithmType: GameState.algorithmType });
    console.log('算法类型已更新:', previousType, '->', GameState.algorithmType);
  } else if (message.action === 'getStatus') {
    console.log('发送状态回复，当前游戏状态:', GameState.gamePhase, '自动模式:', GameState.autoPlayEnabled);
    sendResponse({
      autoPlayEnabled: GameState.autoPlayEnabled,
      gamePhase: GameState.gamePhase,
      candidatesCount: GameState.currentCandidates ? GameState.currentCandidates.length : 0,
      guessCount: GameState.guessCount,
      connectionActive: !!GameState.activeSocket,
      guessInterval: GameState.guessInterval,
      algorithmType: GameState.algorithmType
    });
  } else if (message.action === 'startAlgorithmTest') {
    // 开始算法测试
    console.log('收到算法测试命令', message.options || {});
    startAlgorithmTest(message.options || {});
  } else if (message.action === 'getPlayerCount') {
    // 发送选手数量
    chrome.runtime.sendMessage({
      action: 'playerCountUpdate',
      count: GameState.allPlayers.length
    });
  } else if (message.action === 'getNeuralStatus') {
    // 获取神经网络状态
    const neuralStatus = {
      isModelTrained: GameState.neuralAlgorithm ? GameState.neuralAlgorithm.isModelTrained : false,
      isTraining: GameState.neuralAlgorithm ? GameState.neuralAlgorithm.isTraining : false,
      historyCount: GameState.guessHistory.length
    };
    
    chrome.runtime.sendMessage({
      action: 'neuralStatusUpdate',
      status: neuralStatus
    });
  } else if (message.action === 'trainNeuralModel') {
    // 训练神经网络模型
    trainNeuralModel();
  }
}

// 广播当前状态到弹出窗口
function broadcastStatus() {
  try {
    // 检查chrome.runtime是否可用
    if (!chrome.runtime) {
      console.log('chrome.runtime不可用，无法广播状态');
      clearAllIntervals();
      return;
    }
    
    const status = {
      autoPlayEnabled: GameState.autoPlayEnabled,
      gamePhase: GameState.gamePhase,
      candidatesCount: GameState.currentCandidates ? GameState.currentCandidates.length : 0,
      guessCount: GameState.guessCount,
      connectionActive: !!GameState.activeSocket,
      guessInterval: GameState.guessInterval,
      algorithmType: GameState.algorithmType
    };
    
    // 安全地发送消息
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: status
    }, function(response) {
      if (chrome.runtime.lastError) {
        // 只记录一次错误信息，避免重复报错
        if (chrome.runtime.lastError.message !== window.lastBroadcastError) {
          console.log('状态广播错误 (已处理):', chrome.runtime.lastError.message);
          window.lastBroadcastError = chrome.runtime.lastError.message;
        }
        
        // 如果是扩展上下文失效，清除定时器
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          clearAllIntervals();
        } else if (chrome.runtime.lastError.message.includes('message port closed')) {
          // 弹出窗口已关闭，这是正常现象，可以继续发送
          // 什么也不做，只是防止出现未捕获的错误
        }
      } else {
        // 重置上一个错误
        window.lastBroadcastError = null;
      }
    });
  } catch (error) {
    console.log('广播状态出错:', error);
    clearAllIntervals();
  }
}

// 清除所有定时器
function clearAllIntervals() {
  // 检查是否已经清除，避免重复清除操作
  if (!window.intervalsCleared) {
    if (window.statusInterval) {
      clearInterval(window.statusInterval);
      window.statusInterval = null;
      console.log('已停止状态广播定时器');
    }
    // 标记已清除
    window.intervalsCleared = true;
  }
}

/**
 * 从WebSocket响应中提取反馈信息
 * @param {Object} wsResponse - WebSocket响应对象
 * @returns {Object} - 处理过的反馈信息
 */
function extractFeedbackFromResponse(wsResponse) {
  try {
    console.log('尝试从响应提取反馈信息');
    
    // 尝试不同的响应格式
    
    // 格式1: 原网站格式
    if (wsResponse.players) {
      // 查找最后一次猜测及其反馈
      const currentPlayer = wsResponse.players.find(p => p.id === wsResponse.meta?.userId);
      
      if (currentPlayer && currentPlayer.guesses && currentPlayer.guesses.length > 0) {
        // 获取最后一次猜测
        const lastGuessResponse = currentPlayer.guesses[currentPlayer.guesses.length - 1];
        
        // 提取反馈信息
        const feedback = {
          playerId: lastGuessResponse.id,
          isSuccess: lastGuessResponse.isSuccess,
          feedback: {}
        };
        
        // 提取各属性的反馈
        for (const attr of GameState.algorithm.ATTRIBUTES_TO_COMPARE) {
          if (attr === 'nationality') {
            feedback.feedback[attr] = lastGuessResponse.nationality;
          } else if (attr === 'age') {
            feedback.feedback[attr] = lastGuessResponse.age;
          } else if (attr === 'majorAppearances') {
            feedback.feedback[attr] = lastGuessResponse.majorAppearances;
          } else if (attr === 'team') {
            feedback.feedback[attr] = lastGuessResponse.team;
          } else if (attr === 'role') {
            feedback.feedback[attr] = lastGuessResponse.role;
          } else if (attr === 'region') {
            // 根据nationality的反馈来确定region反馈
            if (lastGuessResponse.nationality && lastGuessResponse.nationality.result === 'INCORRECT_CLOSE') {
              feedback.feedback[attr] = { value: null, result: "CORRECT" };
            } else if (lastGuessResponse.nationality && lastGuessResponse.nationality.result === 'CORRECT') {
              feedback.feedback[attr] = { value: null, result: "CORRECT" };
            } else {
              feedback.feedback[attr] = { value: null, result: "INCORRECT" };
            }
          }
        }
        
        console.log('提取到原格式反馈:', feedback);
        return feedback;
      }
    }
    
    // 格式2: blast.tv可能的格式
    if (wsResponse.type === 'GUESS_FEEDBACK' && wsResponse.payload) {
      const guessData = wsResponse.payload;
      
      // 提取反馈信息
      const feedback = {
        playerId: GameState.lastGuess ? GameState.lastGuess.id : guessData.playerId,
        isSuccess: guessData.isCorrect === true,
        feedback: {}
      };
      
      // 获取反馈数据
      const feedbackData = guessData.feedback || {};
      
      // 逐个属性提取反馈
      for (const attr of GameState.algorithm.ATTRIBUTES_TO_COMPARE) {
        if (feedbackData[attr]) {
          feedback.feedback[attr] = feedbackData[attr];
        }
      }
      
      // 特殊情况处理
      if (feedbackData.country && !feedback.feedback.nationality) {
        feedback.feedback.nationality = feedbackData.country;
      }
      
      if (feedbackData.majors && !feedback.feedback.majorAppearances) {
        feedback.feedback.majorAppearances = feedbackData.majors;
      }
      
      console.log('提取到blast.tv格式反馈:', feedback);
      return feedback;
    }
    
    // 格式3: 更多可能的格式...
    // 未来可以根据实际观察到的响应格式添加更多提取逻辑
    
    return null;
  } catch (error) {
    console.error('提取反馈信息出错:', error);
    return null;
  }
}

// 新增函数：尝试进行第一次猜测
function tryFirstGuess(delayMs = null) {
  // 如果没有指定延迟，使用默认猜测间隔
  if (delayMs === null) {
    delayMs = GameState.guessInterval;
  }
  
  console.log('尝试进行第一次猜测检查 - 当前条件:');
  console.log('- 游戏状态:', GameState.gamePhase);
  console.log('- 自动模式:', GameState.autoPlayEnabled);
  console.log('- 已猜测次数:', GameState.guessCount);
  console.log('- 候选人数量:', GameState.currentCandidates ? GameState.currentCandidates.length : 0);
  console.log('- WebSocket连接:', !!GameState.activeSocket);
  console.log('- 算法模块:', !!GameState.algorithm);
  
  // 确保所有条件都满足
  if (GameState.gamePhase === 'game' && GameState.autoPlayEnabled && GameState.guessCount === 0 && 
      GameState.currentCandidates && GameState.currentCandidates.length > 0 && 
      GameState.algorithm && GameState.activeSocket) {
    
    // 根据延迟时间决定如何进行猜测
    if (delayMs <= 0) {
      // 延迟为0时立即执行
      console.log('间隔为0，立即进行第一次猜测');
      // 立即进行猜测，但仍然进行条件检查
      if (GameState.gamePhase === 'game' && GameState.autoPlayEnabled && GameState.guessCount === 0) {
        console.log('开始执行第一次猜测');
        makeNextGuess();
      } else {
        console.log('条件已变化，取消第一次猜测');
      }
    } else {
      // 有延迟时使用setTimeout
      console.log(`所有条件满足，将在 ${delayMs}ms 后进行第一次猜测`);
      setTimeout(() => {
        // 再次检查条件，确保在延迟期间条件没有变化
        if (GameState.gamePhase === 'game' && GameState.autoPlayEnabled && GameState.guessCount === 0) {
          console.log('开始执行第一次猜测');
          makeNextGuess();
        } else {
          console.log('延迟期间条件已变化，取消第一次猜测');
        }
      }, delayMs);
    }
    return true;
  } else {
    console.log('不满足第一次猜测条件，跳过');
    return false;
  }
}

// 算法测试功能 - 遍历所有玩家作为目标进行猜测
async function startAlgorithmTest(options = {}) {
  if (!GameState.algorithm || !GameState.allPlayers || GameState.allPlayers.length === 0) {
    console.error('算法或玩家数据未加载，无法进行测试');
    chrome.runtime.sendMessage({
      action: 'algorithmTestComplete',
      results: { 
        successCount: 0, 
        totalTests: 0, 
        totalGuesses: 0,
        error: '算法或玩家数据未加载'
      }
    });
    return;
  }
  
  // 重置全局猜测状态
  window.lastGuessId = null;
  window.consecutiveGuessCounts = 0;
  console.log('重置猜测历史状态，准备开始测试');
  
  console.log('开始算法测试，玩家总数:', GameState.allPlayers.length);
  
  // 测试配置
  const maxGuesses = options.maxGuesses || 8; // 最大猜测次数
  const testAll = options.testAll || false; // 是否测试所有玩家
  const detailed = options.detailed || false; // 是否生成详细失败报告
  const testSampleSize = testAll ? GameState.allPlayers.length : Math.min(options.sampleSize || 100, GameState.allPlayers.length); // 测试样本大小
  const useFixedSample = options.useFixedSample || false; // 是否使用固定测试集
  
  // 选择测试样本
  let samplePlayers;
  if (testAll) {
    // 测试所有玩家
    samplePlayers = [...GameState.allPlayers];
    console.log(`将对所有 ${GameState.allPlayers.length} 名玩家进行测试`);
  } else if (useFixedSample) {
    // 使用固定测试集 - 例如按照ID或昵称排序后的前N个
    samplePlayers = [...GameState.allPlayers].sort((a, b) => a.nickname.localeCompare(b.nickname)).slice(0, testSampleSize);
    console.log(`将对 ${testSampleSize} 名固定排序玩家进行测试（按昵称排序）`);
  } else {
    // 随机选择测试样本
    samplePlayers = getRandomSample(GameState.allPlayers, testSampleSize);
    console.log(`将对 ${testSampleSize} 名随机玩家进行测试`);
  }
  
  // 测试结果统计
  let successCount = 0;
  let totalGuesses = 0;
  let failedTests = [];
  
  // 遍历每个玩家进行测试
  for (let i = 0; i < samplePlayers.length; i++) {
    const targetPlayer = samplePlayers[i];
    console.log(`测试 ${i+1}/${testSampleSize}: 目标选手 ${targetPlayer.nickname}`);
    
    // 每个测试开始前重置猜测状态
    window.lastGuessId = null;
    window.consecutiveGuessCounts = 0;
    
    // 重置测试环境
    let testCandidates = [...GameState.allPlayers];
    let guessCountForTest = 0;
    let success = false;
    let guessHistory = []; // 添加猜测历史记录
    
    // 进行猜测直到成功或达到最大次数
    while (guessCountForTest < maxGuesses && testCandidates.length > 0) {
      // 找到最佳猜测
      const guess = GameState.algorithm.findBestGuess(testCandidates, GameState.allPlayers, GameState.algorithm.ATTRIBUTES_TO_COMPARE);
      guessCountForTest++;
      
      // 增强调试信息
      const isRepeatedGuess = guessHistory.length > 0 && 
                             guessHistory[guessHistory.length - 1].guessPlayer.id === guess.id;
      console.log(`猜测 ${guessCountForTest}: ${guess.nickname} (候选人数量: ${testCandidates.length}${isRepeatedGuess ? ', 重复猜测' : ''})`);
      
      // 检查是否猜中
      if (guess.id === targetPlayer.id) {
        success = true;
        console.log(`成功猜中 ${targetPlayer.nickname}，用了 ${guessCountForTest} 次猜测`);
        break;
      }
      
      // 模拟游戏反馈
      const feedback = simulateFeedback(guess, targetPlayer);
      
      // 记录本次猜测信息
      if (detailed) {
        const guessRecord = {
          guessPlayer: {
            id: guess.id,
            nickname: guess.nickname,
            nationality: guess.nationality,
            region: guess.region,
            age: guess.age,
            majorAppearances: guess.majorAppearances,
            team: guess.team,
            role: guess.role
          },
          feedback: JSON.parse(JSON.stringify(feedback)),
          candidatesBefore: testCandidates.length
        };
        guessHistory.push(guessRecord);
      }
      
      // 根据反馈过滤候选人
      const processedFeedback = GameState.algorithm.processGameFeedback({feedback}, GameState.algorithm.ATTRIBUTES_TO_COMPARE);
      const previousCount = testCandidates.length;
      testCandidates = GameState.algorithm.filterCandidates(testCandidates, guess, processedFeedback, GameState.algorithm.ATTRIBUTES_TO_COMPARE);
      
      // 记录过滤后的候选人数量
      if (detailed && guessHistory.length > 0) {
        guessHistory[guessHistory.length - 1].candidatesAfter = testCandidates.length;
        
        // 额外记录处理后的反馈和过滤后剩余的候选人
        guessHistory[guessHistory.length - 1].processedFeedback = processedFeedback;
        if (testCandidates.length < 10) {
          // 如果候选人很少，记录下来以便调试
          guessHistory[guessHistory.length - 1].remainingCandidates = testCandidates.map(c => ({
            id: c.id,
            nickname: c.nickname,
            nationality: c.nationality,
            region: c.region,
            age: c.age,
            majorAppearances: c.majorAppearances
          }));
        }
      }
      
      // 检查候选人数量
      if (testCandidates.length === 0) {
        console.warn(`测试失败: 候选人被过滤完，无法继续猜测 ${targetPlayer.nickname}`);
        break;
      }
    }
    
    // 更新统计
    if (success) {
      successCount++;
      totalGuesses += guessCountForTest;
    } else {
      // 添加失败测试信息
      const failedTest = {
        player: targetPlayer.nickname,
        id: targetPlayer.id,
        guesses: guessCountForTest,
        reason: testCandidates.length === 0 ? "候选人被过滤完" : "达到最大猜测次数",
        nationality: targetPlayer.nationality,
        region: targetPlayer.region,
        age: targetPlayer.age,
        majorAppearances: targetPlayer.majorAppearances,
        team: targetPlayer.team,
        role: targetPlayer.role,
        remainingCandidates: testCandidates.length
      };
      
      // 如果需要详细信息，添加猜测历史
      if (detailed) {
        failedTest.guessHistory = guessHistory;
      }
      
      failedTests.push(failedTest);
    }
    
    // 每完成一个测试，发送进度更新
    chrome.runtime.sendMessage({
      action: 'algorithmTestUpdate',
      data: {
        current: i + 1,
        total: testSampleSize,
        successCount: successCount
      }
    });
    
    // 短暂延迟以避免界面冻结
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // 计算最终结果
  const finalResults = {
    successCount,
    totalTests: testSampleSize,
    totalGuesses,
    avgGuesses: successCount > 0 ? totalGuesses / successCount : 0,
    successRate: successCount / testSampleSize,
    failedTests
  };
  
  console.log('算法测试完成，结果:', finalResults);
  
  // 发送测试完成消息
  chrome.runtime.sendMessage({
    action: 'algorithmTestComplete',
    results: finalResults
  });
}

// 模拟游戏反馈
function simulateFeedback(guessPlayer, targetPlayer) {
  const feedback = {};
  
  // 遍历每个属性进行比较
  for (const attr of GameState.algorithm.ATTRIBUTES_TO_COMPARE) {
    if (attr === 'nationality') {
      // 国籍比较
      if (guessPlayer.nationality === targetPlayer.nationality) {
        feedback[attr] = { result: 'CORRECT' };
      } else if (guessPlayer.region === targetPlayer.region) {
        // 同一地区不同国家 - 仅在这种情况下使用 INCORRECT_CLOSE
        feedback[attr] = { result: 'INCORRECT_CLOSE' };
      } else {
        // 不同国籍不同地区
        feedback[attr] = { result: 'INCORRECT' };
      }
    } else if (attr === 'age') {
      // 年龄比较
      if (guessPlayer.age === targetPlayer.age) {
        feedback[attr] = { result: 'CORRECT' };
      } else if (guessPlayer.age > targetPlayer.age) {
        // 猜测值太高
        if (guessPlayer.age - targetPlayer.age <= 2) {
          feedback[attr] = { result: 'HIGH_CLOSE' };
        } else {
          feedback[attr] = { result: 'HIGH_NOT_CLOSE' };
        }
      } else {
        // 猜测值太低
        if (targetPlayer.age - guessPlayer.age <= 2) {
          feedback[attr] = { result: 'LOW_CLOSE' };
        } else {
          feedback[attr] = { result: 'LOW_NOT_CLOSE' };
        }
      }
    } else if (attr === 'majorAppearances') {
      // Major次数比较
      if (guessPlayer.majorAppearances === targetPlayer.majorAppearances) {
        feedback[attr] = { result: 'CORRECT' };
      } else if (guessPlayer.majorAppearances > targetPlayer.majorAppearances) {
        // 猜测值太高
        if (guessPlayer.majorAppearances - targetPlayer.majorAppearances <= 1) {
          feedback[attr] = { result: 'HIGH_CLOSE' };
        } else {
          feedback[attr] = { result: 'HIGH_NOT_CLOSE' };
        }
      } else {
        // 猜测值太低
        if (targetPlayer.majorAppearances - guessPlayer.majorAppearances <= 1) {
          feedback[attr] = { result: 'LOW_CLOSE' };
        } else {
          feedback[attr] = { result: 'LOW_NOT_CLOSE' };
        }
      }
    } else {
      // 其他属性简单比较（team, role, region）
      if (guessPlayer[attr] === targetPlayer[attr]) {
        feedback[attr] = { result: 'CORRECT' };
      } else {
        feedback[attr] = { result: 'INCORRECT' };
      }
    }
  }
  
  return feedback;
}

// 获取随机样本
function getRandomSample(array, size) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

// 检查神经网络算法是否准备好
async function isNeuralNetworkReady() {
  try {
    // 检查神经网络算法模块是否已加载
    if (!GameState.neuralAlgorithm) {
      console.log('神经网络算法模块未加载');
      return false;
    }
    
    // 检查TensorFlow.js是否已加载到页面环境中
    let tfLoaded = false;
    try {
      tfLoaded = await isTensorFlowLoaded();
      console.log('TensorFlow.js加载状态检查结果:', tfLoaded);
    } catch (error) {
      console.warn('检查TensorFlow.js加载状态失败:', error.message);
      // 继续检查，不直接返回失败
    }
    
    // 如果TensorFlow未加载，尝试再次加载
    if (!tfLoaded) {
      console.log('TensorFlow.js未加载，尝试加载...');
      try {
        // 尝试加载TensorFlow
        await loadTensorFlowIntoPage();
        console.log('TensorFlow.js加载成功');
        // 加载成功后稍等一会儿让TensorFlow初始化
        await new Promise(resolve => setTimeout(resolve, 500));
        tfLoaded = true;
      } catch (loadError) {
        console.error('加载TensorFlow.js失败:', loadError.message);
        tfLoaded = false;
      }
    }
    
    // 如果还是无法加载TensorFlow，则神经网络不可用
    if (!tfLoaded) {
      console.log('TensorFlow.js无法加载，神经网络不可用');
      return false;
    }
    
    // 创建一个Promise来检查神经网络状态
    const checkNeuralStatus = () => {
      return new Promise((resolve, reject) => {
        // 设置超时
        const timeout = setTimeout(() => {
          reject(new Error('检查神经网络状态超时'));
        }, 5000);
        
        window.addEventListener('neural_network_status', (event) => {
          clearTimeout(timeout);
          resolve(event.detail);
        }, { once: true });
        
        // 创建并插入神经网络检查脚本
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('neural-checker.js');
        
        // 给神经网络检查脚本添加数据属性，传递tf-status-checker.js的URL
        script.dataset.tfStatusCheckerUrl = chrome.runtime.getURL('tf-status-checker.js');
        
        script.onload = function() {
          // 脚本加载后，将其移除
          this.remove();
        };
        script.onerror = function(err) {
          clearTimeout(timeout);
          reject(new Error('加载神经网络检查脚本失败'));
        };
        document.head.appendChild(script);
      });
    };
    
    // 尝试检查神经网络状态
    let neuralStatus;
    try {
      neuralStatus = await checkNeuralStatus();
      console.log('神经网络状态详情:', neuralStatus);
    } catch (error) {
      console.error('检查神经网络状态时出错:', error.message);
      
      // 尝试直接在页面中初始化神经网络
      if (tfLoaded) {
        console.log('尝试备用方案：直接在页面中初始化神经网络');
        try {
          // 先将GameState暴露给页面环境
          await exposeGameStateToPage();
          
          // 使用外部初始化脚本
          const initResult = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              window.removeEventListener('direct_neural_init_complete', onDirectInit);
              reject(new Error('直接初始化神经网络超时'));
            }, 10000);
            
            function onDirectInit(event) {
              clearTimeout(timeout);
              window.removeEventListener('direct_neural_init_complete', onDirectInit);
              resolve(event.detail);
            }
            
            window.addEventListener('direct_neural_init_complete', onDirectInit);
            
            // 加载直接初始化脚本
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('direct-neural-initializer.js');
            script.onload = function() {
              console.log('神经网络直接初始化脚本已加载');
              this.remove();
            };
            script.onerror = function(err) {
              clearTimeout(timeout);
              window.removeEventListener('direct_neural_init_complete', onDirectInit);
              reject(new Error('加载神经网络直接初始化脚本失败'));
              this.remove();
            };
            
            document.head.appendChild(script);
          });
          
          console.log('直接初始化结果:', initResult);
          
          if (initResult.success) {
            // 如果初始化成功，返回true
            return true;
          }
        } catch (initError) {
          console.error('直接初始化神经网络失败:', initError);
        }
      }
      
      return false;
    }
    
    // 如果神经网络不可用，尝试再次初始化
    if (!neuralStatus.available && tfLoaded) {
      console.log('神经网络不可用但TensorFlow已加载，尝试重新初始化...');
      
      try {
        // 使用外部重新初始化脚本
        const reinitPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('neural_reinit_complete', onReinitComplete);
            reject(new Error('重新初始化神经网络超时'));
          }, 10000);
          
          function onReinitComplete(event) {
            clearTimeout(timeout);
            window.removeEventListener('neural_reinit_complete', onReinitComplete);
            
            if (event.detail && event.detail.success) {
              resolve(event.detail);
            } else {
              reject(new Error(event.detail.error || '重新初始化失败'));
            }
          }
          
          window.addEventListener('neural_reinit_complete', onReinitComplete);
          
          // 先将GameState暴露给页面环境
          exposeGameStateToPage().then(() => {
            // 加载重新初始化脚本
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('neural-reinitializer.js');
            script.onload = function() {
              console.log('神经网络重新初始化脚本已加载');
              this.remove();
            };
            script.onerror = function(err) {
              clearTimeout(timeout);
              window.removeEventListener('neural_reinit_complete', onReinitComplete);
              reject(new Error('加载神经网络重新初始化脚本失败'));
              this.remove();
            };
            
            document.head.appendChild(script);
          });
        });
        
        const reinitResult = await reinitPromise;
        console.log('重新初始化结果:', reinitResult);
        
        if (reinitResult.success) {
          // 再次检查神经网络状态
          try {
            neuralStatus = await checkNeuralStatus();
            console.log('重新初始化后的神经网络状态:', neuralStatus);
          } catch (rechecktError) {
            console.error('重新检查神经网络状态时出错:', rechecktError);
            return reinitResult.success; // 使用重新初始化结果
          }
        }
      } catch (reinitError) {
        console.error('重新初始化神经网络失败:', reinitError);
      }
    }
    
    return neuralStatus.available;
  } catch (error) {
    console.error('检查神经网络状态时出错:', error);
    return false;
  }
}

// 在页面环境中加载TensorFlow.js库
function loadTensorFlowIntoPage() {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('在页面环境中加载TensorFlow.js...');
      
      // 先检查是否已经加载
      let isLoaded = false;
      try {
        isLoaded = await isTensorFlowLoaded();
      } catch (checkError) {
        console.warn('检查TensorFlow.js状态失败:', checkError.message);
        // 继续尝试加载，而不是直接失败
      }
      
      if (isLoaded) {
        console.log('TensorFlow.js已经加载到页面环境中');
        return resolve();
      }
      
      // 获取TensorFlow.js的完整URL
      const tensorflowUrl = chrome.runtime.getURL('tensorflow.min.js');
      console.log('TensorFlow.js URL:', tensorflowUrl);
      
      // 使用三种不同的方法尝试加载TensorFlow，提高成功率
      // 方法1：使用direct-tf-loader.js (带URL参数的方式)
      console.log('尝试方法1: 使用直接加载器...');
      
      // 设置事件监听
      const directLoadListener = function(event) {
        window.removeEventListener('tensorflowDirectLoaded', directLoadListener);
        
        if (event.detail.success) {
          console.log('方法1成功：TensorFlow.js直接加载成功，版本:', event.detail.version);
          resolve();
          return true;
        } else {
          console.warn('方法1失败：直接加载TensorFlow.js失败:', event.detail.error);
          return false;
        }
      };
      
      window.addEventListener('tensorflowDirectLoaded', directLoadListener);
      
      // 注入直接加载器脚本 (带URL参数)
      const loaderUrl = chrome.runtime.getURL('direct-tf-loader.js') + `?tfUrl=${encodeURIComponent(tensorflowUrl)}`;
      const directScript = document.createElement('script');
      directScript.src = loaderUrl;
      directScript.async = false;
      
      // 设置20秒超时
      const loadTimeout = setTimeout(() => {
        window.removeEventListener('tensorflowDirectLoaded', directLoadListener);
        
        // 尝试方法2 (tf-loader.js方式)
        console.log('方法1超时，尝试方法2: 使用tf-loader.js...');
        tryLoadWithTfLoader(tensorflowUrl).then(resolve).catch(error => {
          console.warn('方法2失败:', error);
          
          // 尝试方法3 (内联脚本方式)
          console.log('尝试方法3: 直接内联脚本...');
          tryInlineLoader(tensorflowUrl).then(resolve).catch(finalError => {
            console.error('所有加载方法都失败:', finalError);
            reject(new Error('无法加载TensorFlow.js: 所有尝试都失败'));
          });
        });
      }, 20000);
      
      directScript.onload = function() {
        console.log('直接加载器脚本已加载');
        // 移除脚本但保持事件监听
        this.remove();
      };
      
      directScript.onerror = function(err) {
        clearTimeout(loadTimeout);
        window.removeEventListener('tensorflowDirectLoaded', directLoadListener);
        console.warn('加载直接加载器脚本失败，尝试备用方法');
        
        // 尝试备用方法
        tryLoadWithTfLoader(tensorflowUrl).then(resolve).catch(error => {
          console.warn('备用方法失败:', error);
          reject(new Error(`无法加载TensorFlow.js: ${error.message}`));
        });
        
        this.remove();
      };
      
      document.head.appendChild(directScript);
      
    } catch (error) {
      console.error('加载TensorFlow.js时出错:', error);
      reject(error);
    }
  });
}

// 使用tf-loader.js尝试加载TensorFlow
function tryLoadWithTfLoader(tensorflowUrl) {
  return new Promise((resolve, reject) => {
    try {
      // 注入URL设置脚本
      const urlScript = document.createElement('script');
      urlScript.textContent = `window.tensorflowJsUrl = "${tensorflowUrl}";`;
      document.head.appendChild(urlScript);
      setTimeout(() => urlScript.remove(), 100);
      
      // 设置事件监听
      const loadListener = function(event) {
        window.removeEventListener('tensorflowLoaded', loadListener);
        
        if (event.detail.success) {
          console.log('TensorFlow.js通过tf-loader.js加载成功');
          resolve();
        } else {
          reject(new Error(`通过tf-loader.js加载失败: ${event.detail.error}`));
        }
      };
      
      window.addEventListener('tensorflowLoaded', loadListener);
      
      // 设置超时
      const timeout = setTimeout(() => {
        window.removeEventListener('tensorflowLoaded', loadListener);
        reject(new Error('通过tf-loader.js加载超时'));
      }, 15000);
      
      // 注入tf-loader.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('tf-loader.js');
      script.async = false;
      
      script.onload = function() {
        console.log('tf-loader.js脚本已加载');
        this.remove();
      };
      
      script.onerror = function() {
        clearTimeout(timeout);
        window.removeEventListener('tensorflowLoaded', loadListener);
        reject(new Error('加载tf-loader.js脚本失败'));
        this.remove();
      };
      
      document.head.appendChild(script);
      
    } catch (error) {
      reject(error);
    }
  });
}

// 直接内联加载TensorFlow (方法3)
function tryInlineLoader(tensorflowUrl) {
  return new Promise((resolve, reject) => {
    try {
      // 创建内联脚本
      const inlineScript = document.createElement('script');
      inlineScript.textContent = `
        (function() {
          console.log('内联方法加载TensorFlow.js...');
          
          // 直接加载TensorFlow.js
          const script = document.createElement('script');
          script.src = "${tensorflowUrl}";
          script.async = false;
          
          script.onload = function() {
            if (typeof tf !== 'undefined') {
              console.log('内联方法成功加载TensorFlow.js!');
              window.tf = tf;
              window.dispatchEvent(new CustomEvent('tensorflowInlineLoaded', { 
                detail: { success: true } 
              }));
            } else {
              console.error('内联方法加载TensorFlow.js后tf对象未定义');
              window.dispatchEvent(new CustomEvent('tensorflowInlineLoaded', { 
                detail: { success: false, error: 'tf对象未定义' } 
              }));
            }
          };
          
          script.onerror = function() {
            console.error('内联方法加载TensorFlow.js失败');
            window.dispatchEvent(new CustomEvent('tensorflowInlineLoaded', { 
              detail: { success: false, error: '加载失败' } 
            }));
          };
          
          document.head.appendChild(script);
        })();
      `;
      
      // 设置事件监听
      const inlineListener = function(event) {
        window.removeEventListener('tensorflowInlineLoaded', inlineListener);
        
        if (event.detail.success) {
          console.log('内联方法成功加载TensorFlow.js');
          resolve();
        } else {
          reject(new Error(`内联方法加载失败: ${event.detail.error || '未知错误'}`));
        }
      };
      
      window.addEventListener('tensorflowInlineLoaded', inlineListener);
      
      // 设置超时
      const timeout = setTimeout(() => {
        window.removeEventListener('tensorflowInlineLoaded', inlineListener);
        reject(new Error('内联方法加载超时'));
      }, 15000);
      
      document.head.appendChild(inlineScript);
      
      // 稍后移除脚本
      setTimeout(() => {
        inlineScript.remove();
      }, 500);
      
    } catch (error) {
      reject(error);
    }
  });
}

// 将GameState对象暴露给页面环境
function exposeGameStateToPage() {
  return new Promise((resolve, reject) => {
    try {
      console.log('将GameState对象暴露给页面环境...');
      
      // 创建一个脚本元素，将GameState对象传递给页面
      const script = document.createElement('script');
      script.textContent = `
        // 在页面环境中创建GameState对象
        if (typeof window.GameState === 'undefined') {
          window.GameState = {};
        }
        window.GameState.exposed = true;
        window.dispatchEvent(new CustomEvent('gamestate_exposed', {
          detail: { success: true }
        }));
      `;
      
      // 监听事件
      const listener = function(event) {
        window.removeEventListener('gamestate_exposed', listener);
        if (event.detail && event.detail.success) {
          console.log('GameState对象已成功暴露到页面环境');
          resolve();
        } else {
          reject(new Error('暴露GameState对象失败'));
        }
      };
      
      window.addEventListener('gamestate_exposed', listener, { once: true });
      
      // 添加脚本
      document.head.appendChild(script);
      setTimeout(() => script.remove(), 100);
      
      // 如果需要，将算法模块也暴露出去
      if (GameState.neuralAlgorithm) {
        const moduleScript = document.createElement('script');
        moduleScript.textContent = `
          window.GameState.neuralAlgorithm = ${JSON.stringify(GameState.neuralAlgorithm, (key, value) => {
            // 排除函数和循环引用
            if (typeof value === 'function') {
              return undefined;
            }
            return value;
          })};
        `;
        document.head.appendChild(moduleScript);
        setTimeout(() => moduleScript.remove(), 100);
      }
    } catch (error) {
      console.error('暴露GameState对象时出错:', error);
      reject(error);
    }
  });
}

// 训练神经网络模型
async function trainNeuralModel() {
  console.log('开始训练神经网络模型流程...');
  
  if (!GameState.neuralAlgorithm) {
    console.error('神经网络算法模块未加载，无法训练模型');
    
    chrome.runtime.sendMessage({
      action: 'neuralTrainingComplete',
      success: false,
      error: '神经网络算法模块未加载'
    });
    
    return;
  }
  
  try {
    console.log('准备加载TensorFlow.js...');
    
    // 确保TensorFlow.js先加载到页面环境中
    try {
      await loadTensorFlowIntoPage();
      console.log('TensorFlow.js成功加载到页面环境');
    } catch (tfError) {
      console.error('TensorFlow.js加载失败:', tfError);
      throw new Error(`TensorFlow.js加载失败: ${tfError.message}`);
    }
    
    // 验证TensorFlow.js是否工作正常 - 使用外部脚本
    try {
      console.log('验证TensorFlow.js是否工作正常...');
      
      // 创建事件监听
      const validationPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('tf_validation_complete', onValidationComplete);
          reject(new Error('验证TensorFlow.js超时'));
        }, 8000); // 增加超时时间
        
        function onValidationComplete(event) {
          clearTimeout(timeout);
          window.removeEventListener('tf_validation_complete', onValidationComplete);
          
          if (event.detail && event.detail.success) {
            resolve(event.detail);
          } else {
            reject(new Error(event.detail.error || '验证失败'));
          }
        }
        
        window.addEventListener('tf_validation_complete', onValidationComplete);
        
        // 加载验证脚本
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('tf-validator.js');
        script.onload = function() {
          console.log('TensorFlow验证脚本已加载');
          this.remove();
        };
        script.onerror = function(err) {
          clearTimeout(timeout);
          window.removeEventListener('tf_validation_complete', onValidationComplete);
          reject(new Error('加载TensorFlow验证脚本失败'));
          this.remove();
        };
        
        document.head.appendChild(script);
      });
      
      const validationResult = await validationPromise;
      console.log('TensorFlow.js验证成功，版本:', validationResult.version);
      
    } catch (validationError) {
      console.error('TensorFlow.js验证失败:', validationError);
      throw new Error(`TensorFlow.js验证失败: ${validationError.message}`);
    }
    
    // 等待确认神经网络算法准备就绪 - 使用之前修改后的方法，它现在使用外部脚本
    console.log('检查神经网络是否准备就绪...');
    let neuralReady = false;
    try {
      neuralReady = await isNeuralNetworkReady();
      console.log('神经网络准备状态:', neuralReady);
    } catch (checkError) {
      console.error('检查神经网络状态失败:', checkError);
      throw new Error(`检查神经网络状态失败: ${checkError.message}`);
    }
    
    if (!neuralReady) {
      // 使用外部脚本初始化神经网络
      console.log('神经网络未准备就绪，尝试通过外部脚本初始化...');
      
      try {
        // 先将GameState暴露给页面环境
        await exposeGameStateToPage();
        
        // 加载外部初始化脚本
        const initPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('neural_manual_init_complete', onInitComplete);
            reject(new Error('初始化神经网络超时'));
          }, 10000);
          
          function onInitComplete(event) {
            clearTimeout(timeout);
            window.removeEventListener('neural_manual_init_complete', onInitComplete);
            
            if (event.detail && event.detail.success) {
              resolve(event.detail);
            } else {
              reject(new Error(event.detail.error || '初始化失败'));
            }
          }
          
          window.addEventListener('neural_manual_init_complete', onInitComplete);
          
          // 加载初始化脚本
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL('neural-initializer.js');
          script.onload = function() {
            console.log('神经网络初始化脚本已加载');
            this.remove();
          };
          script.onerror = function(err) {
            clearTimeout(timeout);
            window.removeEventListener('neural_manual_init_complete', onInitComplete);
            reject(new Error('加载神经网络初始化脚本失败'));
            this.remove();
          };
          
          document.head.appendChild(script);
        });
        
        const initResult = await initPromise;
        console.log('神经网络手动初始化结果:', initResult);
        
        if (!initResult.success) {
          throw new Error(`手动初始化神经网络失败: ${initResult.error || '未知错误'}`);
        }
        
        // 成功手动初始化
        neuralReady = true;
      } catch (manualInitError) {
        console.error('尝试手动初始化失败:', manualInitError);
        throw new Error('神经网络算法未准备就绪，通过外部脚本初始化也失败');
      }
    }
    
    // 检查是否有足够的训练数据
    if (!GameState.guessHistory || GameState.guessHistory.length < 10) {
      console.warn('训练数据不足，需要至少10条记录，当前:', GameState.guessHistory.length);
      
      // 创建测试数据进行训练
      console.log('使用算法测试生成训练数据...');
      await generateTrainingData();
    }
    
    console.log(`开始训练神经网络模型，使用 ${GameState.guessHistory.length} 条历史记录`);
    
    // 等待一会儿确保TensorFlow.js完全初始化
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 开始训练
    console.log('调用神经网络训练方法...');
    try {
      await GameState.neuralAlgorithm.trainModel(GameState.guessHistory, GameState.allPlayers);
      
      // 训练完成后保存模型
      if (GameState.neuralAlgorithm.isModelTrained) {
        await GameState.neuralAlgorithm.saveModel();
        console.log('神经网络模型训练完成并保存');
        
        // 通知训练成功
        chrome.runtime.sendMessage({
          action: 'neuralTrainingComplete',
          success: true
        });
      } else {
        throw new Error('训练完成但模型未标记为已训练，可能训练失败');
      }
    } catch (trainError) {
      console.error('训练模型时出错:', trainError);
      throw new Error(`训练模型时出错: ${trainError.message}`);
    }
    
  } catch (error) {
    console.error('训练神经网络模型失败:', error);
    
    chrome.runtime.sendMessage({
      action: 'neuralTrainingComplete',
      success: false,
      error: error.message
    });
  }
}

// 生成神经网络训练数据
async function generateTrainingData() {
  // 生成100个随机训练样本
  const sampleSize = 100;
  const samplePlayers = getRandomSample(GameState.allPlayers, sampleSize);
  
  console.log(`开始生成 ${sampleSize} 个训练样本`);
  GameState.guessHistory = [];
  
  // 对每个样本进行模拟猜测
  for (let i = 0; i < samplePlayers.length; i++) {
    const targetPlayer = samplePlayers[i];
    let testCandidates = [...GameState.allPlayers];
    let guessCountForTest = 0;
    
    // 最多尝试5次猜测
    while (guessCountForTest < 5 && testCandidates.length > 0) {
      // 使用信息熵算法找到最佳猜测
      const guess = GameState.algorithm.findBestGuess(testCandidates, GameState.allPlayers);
      
      // 模拟反馈
      const feedback = simulateFeedback(guess, targetPlayer);
      
      // 记录猜测历史
      GameState.guessHistory.push({
        guessPlayer: guess,
        feedback: feedback,
        actualPlayer: targetPlayer
      });
      
      // 如果猜中了，退出循环
      if (guess.id === targetPlayer.id) {
        break;
      }
      
      // 过滤候选人
      const processedFeedback = GameState.algorithm.processGameFeedback({feedback});
      testCandidates = GameState.algorithm.filterCandidates(testCandidates, guess, processedFeedback);
      
      guessCountForTest++;
    }
    
    // 状态更新
    if (i % 10 === 0) {
      console.log(`已生成 ${i} 个训练样本，当前历史记录数量: ${GameState.guessHistory.length}`);
    }
  }
  
  console.log(`训练数据生成完成，共 ${GameState.guessHistory.length} 条记录`);
  
  // 保存猜测历史
  chrome.storage.local.set({ guessHistory: GameState.guessHistory });
  
  return GameState.guessHistory;
}

// 检查TensorFlow.js是否已在页面环境中加载
function isTensorFlowLoaded() {
  // ... existing code ...
}

// 启动插件
initialize(); 