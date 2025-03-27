// 全局变量
let allPlayers = [];
let currentCandidates = [];
let lastGuess = null;
let autoPlayEnabled = false;
let guessCount = 0;
let originalWebSocketSend = null;
let activeSocket = null;
let connectionId = "";
let gamePhase = null;
let algo = null; // 将在加载算法后赋值

// 初始化
async function initialize() {
  console.log('Counterstrikle Helper 插件已加载');
  console.log('当前游戏状态:', gamePhase, '自动模式:', autoPlayEnabled);
  
  // 初始化变量
  window.intervalsCleared = false;
  window.lastBroadcastError = null;
  
  // 加载算法模块
  try {
    // 不再使用new Function()动态评估脚本，改为导入作为模块
    const algorithmUrl = chrome.runtime.getURL('algorithm.js');
    
    // 方法1: 使用动态import加载模块
    try {
      // 尝试使用动态import
      const algorithmModule = await import(algorithmUrl);
      algo = algorithmModule.default || algorithmModule;
      console.log('成功通过import加载算法模块');
    } catch (importError) {
      console.error('通过import加载算法模块失败:', importError);
      
      // 方法2: 回退方案 - 直接创建script标签
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = algorithmUrl;
        script.type = 'module';
        script.onload = () => {
          if (window.AlgorithmModule) {
            algo = window.AlgorithmModule;
            console.log('成功通过script标签加载算法模块');
            resolve();
            continueInitialization(); // 继续初始化流程
          } else {
            console.error('算法模块加载后未找到算法对象');
            reject(new Error('算法模块加载后未找到算法对象'));
          }
        };
        script.onerror = (err) => {
          console.error('通过script标签加载算法模块失败:', err);
          reject(err);
        };
        document.head.appendChild(script);
      });
    }
  } catch (error) {
    console.error('加载算法模块失败:', error);
  }
  
  // 继续初始化
  await continueInitialization();
}

// 拆分初始化过程，以便在脚本加载后继续
async function continueInitialization() {
  // 从存储中加载设置
  try {
    const settings = await chrome.storage.local.get(['autoPlay', 'players']);
    autoPlayEnabled = settings.autoPlay || false;
    console.log('从存储加载自动模式设置:', autoPlayEnabled);
    
    if (settings.players) {
      allPlayers = settings.players;
      console.log(`从缓存加载了 ${allPlayers.length} 名选手数据`);
    } else {
      // 加载选手数据
      await loadPlayersData();
    }
  } catch (error) {
    console.error('加载设置失败:', error);
    // 尝试直接加载选手数据
    await loadPlayersData();
  }
  
  // 覆盖WebSocket
  overrideWebSocket();
  
  // 监听来自插件弹出窗口的消息
  try {
    // 移除可能存在的旧监听器，避免重复
    chrome.runtime.onMessage.removeListener(handleMessage);
    // 添加新监听器
    chrome.runtime.onMessage.addListener(handleMessage);
  } catch (error) {
    console.error('设置消息监听器失败:', error);
    // 如果是扩展上下文失效，清理资源
    if (error.message && error.message.includes('Extension context invalidated')) {
      clearAllIntervals();
      return; // 终止初始化
    }
  }
  
  // 初始化游戏状态
  if (!gamePhase) {
    gamePhase = 'game';
    console.log('初始化游戏状态为game');
    
    // 初始化候选列表
    if (currentCandidates.length === 0) {
      currentCandidates = [...allPlayers];
      guessCount = 0;
      console.log('初始化候选列表，候选人数量:', currentCandidates.length);
    } else {
      console.log('候选列表已存在，跳过初始化，候选人数量:', currentCandidates.length);
    }
    
    // 尝试第一次猜测
    console.log('初始化完成，尝试第一次猜测');
    setTimeout(() => tryFirstGuess(1000), 2000);
  } else {
    console.log('游戏状态已存在:', gamePhase, '跳过初始化');
    
    // 即使游戏状态已存在，仍然尝试第一次猜测
    if (gamePhase === 'game' && guessCount === 0) {
      console.log('游戏已经在进行中，尝试第一次猜测');
      setTimeout(() => tryFirstGuess(1000), 2000);
    }
  }
  
  // 定期通知弹出窗口状态更新
  try {
    // 确保之前的定时器已被清除
    if (window.statusInterval) {
      clearInterval(window.statusInterval);
    }
    // 保存定时器引用
    window.statusInterval = setInterval(broadcastStatus, 1000);
    console.log('已设置状态广播定时器');
  } catch (error) {
    console.error('设置状态广播定时器失败:', error);
  }
  
  // 主动广播一次状态
  setTimeout(broadcastStatus, 500);
}

// 加载选手数据
async function loadPlayersData() {
  try {
    const response = await fetch(chrome.runtime.getURL('players.json'));
    allPlayers = await response.json();
    console.log(`成功加载了 ${allPlayers.length} 名选手数据`);
    
    // 缓存到存储中
    await chrome.storage.local.set({ players: allPlayers });
  } catch (error) {
    console.error('加载选手数据失败:', error);
  }
}

// 覆盖WebSocket以拦截通信
function overrideWebSocket() {
  console.log('开始设置WebSocket监听器...');
  
  // 注入页面脚本
  injectPageScript();
  
  // 定期检查WebSocket连接状态
  setInterval(() => {
    // 我们不再使用executeScript，而是依赖websocket-interceptor.js发送的状态事件
    if (!activeSocket) {
      console.log('等待WebSocket连接...');
    }
  }, 10000);
  
  console.log('WebSocket监听器设置完成');
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
      activeSocket = e.detail && e.detail.active;
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
        lastGuess = allPlayers.find(p => p.id === playerId);
        console.log('猜测选手:', lastGuess ? lastGuess.nickname : '未知选手ID: ' + playerId);
        
        // 如果找不到选手ID，尝试在日志中输出可用的ID列表
        if (!lastGuess) {
          console.log('可用选手ID列表:');
          allPlayers.slice(0, 5).forEach(p => {
            console.log(`- ${p.nickname}: ${p.id}`);
          });
          console.log(`... 及其他 ${allPlayers.length - 5} 名选手`);
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
      gamePhase = message.phase;
      console.log('检测到游戏阶段:', gamePhase);
      handleGameStateChange(gamePhase);
    } else if (message.type === 'GAME_STATE') {
      // blast.tv可能的格式
      gamePhase = message.payload?.state || 'game';
      console.log('检测到blast.tv游戏状态:', gamePhase);
      handleGameStateChange(gamePhase);
    } else if (message.type === 'GUESS_RESPONSE' || message.type === 'GUESS_FEEDBACK') {
      // 可能的猜测响应格式
      console.log('收到猜测响应:', message);
      handleGuessResponse(message);
    }
    
    // 检查是否有猜测反馈
    if (gamePhase === 'game' && lastGuess && autoPlayEnabled && algo) {
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
  console.log('游戏状态变更为:', phase, '当前自动模式:', autoPlayEnabled, '当前猜测次数:', guessCount);
  
  // 如果游戏刚开始，重置状态
  if (phase === 'game' && (!currentCandidates || currentCandidates.length === 0)) {
    console.log('游戏开始，初始化候选列表');
    currentCandidates = [...allPlayers];
    guessCount = 0;
    console.log('重置后候选人数量:', currentCandidates.length);
    
    // 尝试第一次猜测
    tryFirstGuess(1500);
  } else if (phase === 'results' || phase === 'lobby' || phase === 'end') {
    // 游戏结束，重置状态
    console.log('游戏结束或在大厅中，重置状态');
    resetGameState();
  } else if (phase === 'game') {
    console.log('游戏进行中，当前候选人数量:', currentCandidates ? currentCandidates.length : 0);
    
    // 游戏进行中，尝试第一次猜测
    tryFirstGuess(1000);
  }
  
  // 广播状态更新
  broadcastStatus();
}

// 处理猜测响应
function handleGuessResponse(response) {
  if (!lastGuess) {
    console.log('收到猜测响应，但没有上一次猜测记录');
    return;
  }
  
  try {
    // 尝试从blast.tv格式提取反馈
    let feedback = null;
    
    // 提取反馈信息
    if (response.payload) {
      feedback = {
        playerId: lastGuess.id,
        isSuccess: response.payload.isCorrect === true,
        feedback: {}
      };
      
      // 提取各属性的反馈
      // 这里需要根据blast.tv的实际响应格式进行调整
      const feedbackData = response.payload.feedback || {};
      
      for (const attr of algo.ATTRIBUTES_TO_COMPARE) {
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
  const internalFeedback = algo.processGameFeedback(feedback, algo.ATTRIBUTES_TO_COMPARE);
  
  if (!internalFeedback) {
    console.error('无法处理反馈');
    return;
  }
  
  console.log('处理后的反馈:', internalFeedback);
  
  // 根据反馈过滤候选人
  currentCandidates = algo.filterCandidates(
    currentCandidates, 
    lastGuess, 
    internalFeedback, 
    algo.ATTRIBUTES_TO_COMPARE
  );
  
  console.log(`根据反馈过滤后剩余候选人: ${currentCandidates.length}`);
  
  // 检查是否还有候选人
  if (currentCandidates.length === 0) {
    console.error('过滤后没有候选人，算法可能有问题');
    return;
  }
  
  // 自动进行下一次猜测（延迟一点时间）
  if (autoPlayEnabled) {
    setTimeout(() => {
      makeNextGuess();
    }, 1500);
  }
}

// 进行下一次猜测
function makeNextGuess() {
  console.log('尝试进行猜测，条件检查:');
  console.log('- 自动模式:', autoPlayEnabled);
  console.log('- WebSocket连接:', !!activeSocket);
  console.log('- 候选人数量:', currentCandidates ? currentCandidates.length : 0);
  console.log('- 算法模块:', !!algo);
  
  if (!autoPlayEnabled) {
    console.log('自动模式未开启，取消猜测');
    return;
  }
  
  if (!activeSocket) {
    console.log('WebSocket连接不可用，取消猜测');
    return;
  }
  
  if (!currentCandidates || currentCandidates.length === 0) {
    console.log('没有可用的候选人，取消猜测');
    return;
  }
  
  if (!algo) {
    console.log('算法模块未加载，取消猜测');
    return;
  }
  
  // 找到最佳猜测
  console.log('开始计算最佳猜测...');
  const bestGuess = algo.findBestGuess(currentCandidates, allPlayers, algo.ATTRIBUTES_TO_COMPARE);
  
  if (!bestGuess) {
    console.error('无法确定最佳猜测');
    return;
  }
  
  guessCount++;
  console.log(`第 ${guessCount} 次猜测:`, bestGuess.nickname);
  
  // 发送猜测
  const guessMessage = {
    type: "GUESS",
    payload: {
      playerId: bestGuess.id,
      connectionId: connectionId
    }
  };
  
  lastGuess = bestGuess;
  
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
  currentCandidates = [];
  lastGuess = null;
  guessCount = 0;
  console.log('游戏状态已重置');
}

// 处理来自弹出窗口的消息
function handleMessage(message, sender, sendResponse) {
  console.log('收到消息:', message);
  
  if (message.action === 'toggleAutoPlay') {
    const previousAutoPlay = autoPlayEnabled;
    autoPlayEnabled = message.value;
    chrome.storage.local.set({ autoPlay: autoPlayEnabled });
    console.log('自动玩模式切换:', previousAutoPlay, '->', autoPlayEnabled);
    
    // 如果启用了自动模式且游戏正在进行，尝试开始第一次猜测
    if (autoPlayEnabled && !previousAutoPlay && gamePhase === 'game') {
      console.log('自动模式刚刚开启，检查是否可以进行第一次猜测');
      tryFirstGuess(1000);
    }
  } else if (message.action === 'getStatus') {
    console.log('发送状态回复，当前游戏状态:', gamePhase, '自动模式:', autoPlayEnabled);
    sendResponse({
      autoPlayEnabled: autoPlayEnabled,
      gamePhase: gamePhase,
      candidatesCount: currentCandidates ? currentCandidates.length : 0,
      guessCount: guessCount,
      connectionActive: !!activeSocket
    });
  } else if (message.action === 'startAlgorithmTest') {
    // 开始算法测试
    console.log('收到算法测试命令', message.options || {});
    startAlgorithmTest(message.options || {});
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
      autoPlayEnabled: autoPlayEnabled,
      gamePhase: gamePhase,
      candidatesCount: currentCandidates ? currentCandidates.length : 0,
      guessCount: guessCount,
      connectionActive: !!activeSocket
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
        for (const attr of algo.ATTRIBUTES_TO_COMPARE) {
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
        playerId: lastGuess ? lastGuess.id : guessData.playerId,
        isSuccess: guessData.isCorrect === true,
        feedback: {}
      };
      
      // 获取反馈数据
      const feedbackData = guessData.feedback || {};
      
      // 逐个属性提取反馈
      for (const attr of algo.ATTRIBUTES_TO_COMPARE) {
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
function tryFirstGuess(delayMs = 1000) {
  console.log('尝试进行第一次猜测检查 - 当前条件:');
  console.log('- 游戏状态:', gamePhase);
  console.log('- 自动模式:', autoPlayEnabled);
  console.log('- 已猜测次数:', guessCount);
  console.log('- 候选人数量:', currentCandidates ? currentCandidates.length : 0);
  console.log('- WebSocket连接:', !!activeSocket);
  console.log('- 算法模块:', !!algo);
  
  // 确保所有条件都满足
  if (gamePhase === 'game' && autoPlayEnabled && guessCount === 0 && 
      currentCandidates && currentCandidates.length > 0 && 
      algo && activeSocket) {
    console.log(`所有条件满足，将在 ${delayMs}ms 后进行第一次猜测`);
    setTimeout(() => {
      // 再次检查条件，确保在延迟期间条件没有变化
      if (gamePhase === 'game' && autoPlayEnabled && guessCount === 0) {
        console.log('开始执行第一次猜测');
        makeNextGuess();
      } else {
        console.log('延迟期间条件已变化，取消第一次猜测');
      }
    }, delayMs);
    return true;
  } else {
    console.log('不满足第一次猜测条件，跳过');
    return false;
  }
}

// 算法测试功能 - 遍历所有玩家作为目标进行猜测
async function startAlgorithmTest(options = {}) {
  if (!algo || !allPlayers || allPlayers.length === 0) {
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
  
  console.log('开始算法测试，玩家总数:', allPlayers.length);
  
  // 测试配置
  const maxGuesses = options.maxGuesses || 8; // 最大猜测次数
  const testAll = options.testAll || false; // 是否测试所有玩家
  const detailed = options.detailed || false; // 是否生成详细失败报告
  const testSampleSize = testAll ? allPlayers.length : Math.min(options.sampleSize || 100, allPlayers.length); // 测试样本大小
  const useFixedSample = options.useFixedSample || false; // 是否使用固定测试集
  
  // 选择测试样本
  let samplePlayers;
  if (testAll) {
    // 测试所有玩家
    samplePlayers = [...allPlayers];
    console.log(`将对所有 ${allPlayers.length} 名玩家进行测试`);
  } else if (useFixedSample) {
    // 使用固定测试集 - 例如按照ID或昵称排序后的前N个
    samplePlayers = [...allPlayers].sort((a, b) => a.nickname.localeCompare(b.nickname)).slice(0, testSampleSize);
    console.log(`将对 ${testSampleSize} 名固定排序玩家进行测试（按昵称排序）`);
  } else {
    // 随机选择测试样本
    samplePlayers = getRandomSample(allPlayers, testSampleSize);
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
    let testCandidates = [...allPlayers];
    let guessCountForTest = 0;
    let success = false;
    let guessHistory = []; // 添加猜测历史记录
    
    // 进行猜测直到成功或达到最大次数
    while (guessCountForTest < maxGuesses && testCandidates.length > 0) {
      // 找到最佳猜测
      const guess = algo.findBestGuess(testCandidates, allPlayers, algo.ATTRIBUTES_TO_COMPARE);
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
      const processedFeedback = algo.processGameFeedback({feedback}, algo.ATTRIBUTES_TO_COMPARE);
      const previousCount = testCandidates.length;
      testCandidates = algo.filterCandidates(testCandidates, guess, processedFeedback, algo.ATTRIBUTES_TO_COMPARE);
      
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
  for (const attr of algo.ATTRIBUTES_TO_COMPARE) {
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

// 启动插件
initialize(); 