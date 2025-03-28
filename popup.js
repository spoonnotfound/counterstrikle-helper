/**
 * Counterstrikle Helper 弹出窗口脚本
 */

// 在 DOMContentLoaded 事件触发时初始化
document.addEventListener('DOMContentLoaded', initialize);

/**
 * 弹出窗口元素缓存
 */
const UI = {
  // 控制元素
  autoPlayToggle: null,
  algorithmTestButton: null,
  guessIntervalInput: null,
  algorithmSelect: null,
  trainModelButton: null,
  
  // 状态显示元素
  playerCountElement: null,
  gamePhaseElement: null,
  candidatesCountElement: null,
  guessCountElement: null,
  
  // 测试结果元素
  testResultsContainer: null,
  testProgressElement: null,
  progressBarElement: null,
  successRateElement: null,
  avgGuessesElement: null,
  failedTestsContainer: null,
  failedTestsList: null,
  
  // 神经网络元素
  neuralContainer: null,
  neuralStatusElement: null,
  trainingProgressElement: null,
  trainingBarElement: null,
  
  /**
   * 初始化 UI 元素引用
   */
  initialize() {
    // 获取控制元素
    this.autoPlayToggle = document.getElementById('autoPlayToggle');
    this.algorithmTestButton = document.getElementById('algorithmTestButton');
    this.guessIntervalInput = document.getElementById('guessIntervalInput');
    this.algorithmSelect = document.getElementById('algorithmSelect');
    this.trainModelButton = document.getElementById('trainModelButton');
    
    // 获取状态显示元素
    this.playerCountElement = document.getElementById('playerCount');
    this.gamePhaseElement = document.getElementById('gamePhase');
    this.candidatesCountElement = document.getElementById('candidatesCount');
    this.guessCountElement = document.getElementById('guessCount');
    
    // 获取测试结果元素
    this.testResultsContainer = document.getElementById('testResults');
    this.testProgressElement = document.getElementById('testProgress');
    this.progressBarElement = document.getElementById('progressBar');
    this.successRateElement = document.getElementById('successRate');
    this.avgGuessesElement = document.getElementById('avgGuesses');
    this.failedTestsContainer = document.getElementById('failedTestsContainer');
    this.failedTestsList = document.getElementById('failedTestsList');
    
    // 获取神经网络元素
    this.neuralContainer = document.getElementById('neuralContainer');
    this.neuralStatusElement = document.getElementById('neuralStatus');
    this.trainingProgressElement = document.getElementById('trainingProgress');
    this.trainingBarElement = document.getElementById('trainingBar');
  }
};

/**
 * 初始化弹出窗口
 */
async function initialize() {
  try {
    console.log('弹出窗口初始化开始');
    
    // 初始化 UI 元素
    UI.initialize();
    
    // 加载设置
    await loadSettings();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 获取玩家数据数量
    requestPlayerCount();
    
    // 设置消息监听
    setupMessageListeners();
    
    console.log('弹出窗口已加载完成');
  } catch (error) {
    console.error('弹出窗口初始化失败:', error);
  }
}

/**
 * 从存储中加载设置
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(['autoPlay', 'guessInterval', 'algorithmType']);
    UI.autoPlayToggle.checked = settings.autoPlay || false;
    UI.guessIntervalInput.value = settings.guessInterval || 5000;
    if (settings.algorithmType) {
      UI.algorithmSelect.value = settings.algorithmType;
    }
    toggleNeuralPanel(UI.algorithmSelect.value === 'neural');
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 自动模式开关事件
  UI.autoPlayToggle.addEventListener('change', handleAutoPlayToggle);
  
  // 猜测间隔事件
  UI.guessIntervalInput.addEventListener('change', handleGuessIntervalChange);
  
  // 算法测试按钮点击事件
  UI.algorithmTestButton.addEventListener('click', handleAlgorithmTest);
  
  // 算法选择事件
  UI.algorithmSelect.addEventListener('change', handleAlgorithmSelect);
  
  // 训练模型按钮点击事件
  UI.trainModelButton.addEventListener('click', handleTrainModel);
}

/**
 * 处理自动模式开关
 */
function handleAutoPlayToggle() {
  const isEnabled = UI.autoPlayToggle.checked;
  
  // 发送消息到内容脚本
  sendMessageToActiveTab({
    action: 'toggleAutoPlay',
    value: isEnabled
  });
  
  // 保存设置
  chrome.storage.local.set({ autoPlay: isEnabled });
}

/**
 * 处理算法选择变化
 */
function handleAlgorithmSelect() {
  const algorithmType = UI.algorithmSelect.value;
  
  // 向内容脚本发送算法类型
  sendMessageToActiveTab({
    action: 'setAlgorithmType',
    value: algorithmType
  });
  
  // 保存设置
  chrome.storage.local.set({ algorithmType: algorithmType });
  
  // 显示/隐藏神经网络控制面板
  toggleNeuralPanel(algorithmType === 'neural');
}

/**
 * 显示/隐藏神经网络控制面板
 * @param {boolean} show - 是否显示
 */
function toggleNeuralPanel(show) {
  UI.neuralContainer.style.display = show ? 'block' : 'none';
  
  if (show) {
    // 获取神经网络模型状态
    sendMessageToActiveTab({ action: 'getNeuralStatus' });
  }
}

/**
 * 处理神经网络模型训练
 */
function handleTrainModel() {
  // 禁用训练按钮并显示状态
  UI.trainModelButton.disabled = true;
  UI.trainModelButton.textContent = '训练中...';
  UI.neuralStatusElement.textContent = '开始训练模型...';
  UI.trainingBarElement.style.width = '0%';
  
  // 向内容脚本发送训练命令
  sendMessageToActiveTab({
    action: 'trainNeuralModel'
  });
}

/**
 * 处理算法测试按钮点击
 */
function handleAlgorithmTest() {
  // 向内容脚本发送全量测试命令
  sendMessageToActiveTab({ 
    action: 'startAlgorithmTest',
    options: {
      testAll: true,
      detailed: true // 启用详细诊断信息
    }
  });
  
  // 提供用户反馈
  UI.algorithmTestButton.textContent = '测试中...';
  UI.algorithmTestButton.disabled = true;
  
  // 显示测试结果容器
  UI.testResultsContainer.style.display = 'block';
}

/**
 * 发送消息到当前活动标签页
 * @param {Object} message - 要发送的消息
 */
function sendMessageToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
}

/**
 * 请求玩家数据数量
 */
function requestPlayerCount() {
  chrome.runtime.sendMessage({ action: 'getPlayerCount' }, (response) => {
    if (response && response.count) {
      UI.playerCountElement.textContent = response.count;
    } else {
      UI.playerCountElement.textContent = '未加载';
    }
  });
}

/**
 * 设置消息监听器
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'statusUpdate' && message.status) {
      updateUIWithStatus(message.status);
    } else if (message.action === 'algorithmTestUpdate') {
      // 更新算法测试进度和结果
      updateTestProgress(message.data);
    } else if (message.action === 'algorithmTestComplete') {
      // 测试完成，更新最终结果
      updateTestResults(message.results);
      // 恢复按钮状态
      UI.algorithmTestButton.textContent = '本地测试';
      UI.algorithmTestButton.disabled = false;
    } else if (message.action === 'playerCountUpdate') {
      // 更新选手数量
      UI.playerCountElement.textContent = message.count;
    } else if (message.action === 'neuralStatusUpdate') {
      // 更新神经网络状态
      updateNeuralStatus(message.status);
    } else if (message.action === 'neuralTrainingUpdate') {
      // 更新训练进度
      updateTrainingProgress(message.data);
    } else if (message.action === 'neuralTrainingComplete') {
      // 训练完成
      handleTrainingComplete(message);
    }
  });
}

/**
 * 更新算法测试进度
 * @param {Object} data - 进度数据
 */
function updateTestProgress(data) {
  const { current, total, successCount } = data;
  
  // 更新进度文本
  UI.testProgressElement.textContent = `${current}/${total}`;
  
  // 更新进度条
  const percent = (current / total) * 100;
  UI.progressBarElement.style.width = `${percent}%`;
  
  // 更新成功率
  const successRate = ((successCount / current) * 100).toFixed(1);
  UI.successRateElement.textContent = `${successRate}%`;
}

/**
 * 更新算法测试最终结果
 * @param {Object} results - 测试结果
 */
function updateTestResults(results) {
  const { successCount, totalTests, totalGuesses, failedTests } = results;
  
  // 更新成功率
  const successRate = ((successCount / totalTests) * 100).toFixed(1);
  UI.successRateElement.textContent = `${successRate}% (${successCount}/${totalTests})`;
  
  // 更新平均猜测次数
  const avgGuesses = (totalGuesses / totalTests).toFixed(1);
  UI.avgGuessesElement.textContent = avgGuesses;
  
  // 更新失败用例列表
  updateFailedTestsList(failedTests);
}

/**
 * 更新失败用例列表
 * @param {Array} failedTests - 失败的测试用例
 */
function updateFailedTestsList(failedTests) {
  // 清空现有内容
  UI.failedTestsList.innerHTML = '';
  
  // 如果没有失败用例，隐藏容器
  if (!failedTests || failedTests.length === 0) {
    UI.failedTestsContainer.style.display = 'none';
    return;
  }
  
  // 显示失败用例容器
  UI.failedTestsContainer.style.display = 'block';
  
  // 最多显示10个失败用例
  const maxFailuresToShow = 10;
  const testsToShow = failedTests.slice(0, maxFailuresToShow);
  
  // 添加每个失败用例
  testsToShow.forEach(test => displayFailedTest(test));
  
  // 如果还有更多失败用例，显示一条信息
  if (failedTests.length > maxFailuresToShow) {
    const moreFailures = document.createElement('div');
    moreFailures.className = 'more-failures';
    moreFailures.textContent = `还有 ${failedTests.length - maxFailuresToShow} 个失败用例未显示`;
    UI.failedTestsList.appendChild(moreFailures);
  }
}

/**
 * 显示单个失败测试用例
 * @param {Object} test - 失败的测试用例
 */
function displayFailedTest(test) {
  const failureItem = document.createElement('div');
  failureItem.className = 'failure-item';
  
  // 创建详细信息
  let detailsHTML = `
    <strong>${test.player}</strong> - ${test.reason} (猜测次数: ${test.guesses})<br>
    <small>国籍: ${test.nationality}, 地区: ${test.region}, 年龄: ${test.age}, Major次数: ${test.majorAppearances}</small>
  `;
  
  // 添加猜测历史
  if (test.guessHistory && test.guessHistory.length > 0) {
    detailsHTML += `<div class="guess-history">`;
    test.guessHistory.forEach((guess, idx) => {
      // 检查是否是重复猜测
      const isRepeatedGuess = idx > 0 && test.guessHistory[idx-1].guessPlayer.id === guess.guessPlayer.id;
      
      detailsHTML += `
        <div class="guess-item ${isRepeatedGuess ? 'repeated-guess' : ''}">
          <strong>猜测 ${idx+1}:</strong> ${guess.guessPlayer.nickname} 
          (候选: ${guess.candidatesBefore} → ${guess.candidatesAfter})
          ${isRepeatedGuess ? '<span class="repeated-label">重复</span>' : ''}
          <br>
          <small>
            国籍: ${guess.feedback.nationality?.result || '-'}, 
            地区: ${guess.feedback.region?.result || '-'}, 
            年龄: ${guess.feedback.age?.result || '-'}, 
            Major: ${guess.feedback.majorAppearances?.result || '-'}
          </small>
        </div>
      `;
    });
    detailsHTML += `</div>`;
  }
  
  failureItem.innerHTML = detailsHTML;
  UI.failedTestsList.appendChild(failureItem);
}

/**
 * 根据状态更新UI
 * @param {Object} status - 游戏状态
 */
function updateUIWithStatus(status) {
  // 更新界面显示
  UI.gamePhaseElement.textContent = getGamePhaseText(status.gamePhase);
  UI.candidatesCountElement.textContent = status.candidatesCount || '-';
  UI.guessCountElement.textContent = status.guessCount || '-';
  
  // 更新控制元素
  if (status.guessInterval !== undefined && UI.guessIntervalInput.value != status.guessInterval) {
    UI.guessIntervalInput.value = status.guessInterval;
  }
  
  // 更新算法类型
  if (status.algorithmType !== undefined && UI.algorithmSelect.value != status.algorithmType) {
    UI.algorithmSelect.value = status.algorithmType;
    toggleNeuralPanel(status.algorithmType === 'neural');
  }
  
  // 更新连接状态
  if (status.connectionActive) {
    UI.gamePhaseElement.classList.add('connected');
  } else {
    UI.gamePhaseElement.classList.remove('connected');
  }
  
  // 更新自动模式开关
  if (status.autoPlayEnabled !== undefined) {
    UI.autoPlayToggle.checked = status.autoPlayEnabled;
  }
}

/**
 * 转换游戏阶段文本
 * @param {string} phase - 游戏阶段
 * @returns {string} - 显示文本
 */
function getGamePhaseText(phase) {
  if (!phase) return '未检测到游戏';
  
  const phaseMap = {
    'lobby': '等待中',
    'game': '游戏进行中',
    'results': '游戏结束'
  };
  
  return phaseMap[phase] || phase;
}

/**
 * 处理猜测间隔变化
 */
function handleGuessIntervalChange() {
  // 获取输入值并确保在有效范围内
  let interval = parseInt(UI.guessIntervalInput.value);
  
  // 限制最小和最大值
  if (isNaN(interval) || interval < 0) {
    interval = 0;
    UI.guessIntervalInput.value = 0;
  } else if (interval > 15000) {
    interval = 15000;
    UI.guessIntervalInput.value = 15000;
  }
  
  // 发送消息到内容脚本
  sendMessageToActiveTab({
    action: 'setGuessInterval',
    value: interval
  });
  
  // 保存设置
  chrome.storage.local.set({ guessInterval: interval });
}

/**
 * 更新神经网络状态
 * @param {Object} status - 状态信息
 */
function updateNeuralStatus(status) {
  if (!status) return;
  
  const { isModelTrained, isTraining } = status;
  
  if (isTraining) {
    UI.neuralStatusElement.textContent = '模型正在训练中...';
    UI.trainModelButton.disabled = true;
    UI.trainModelButton.textContent = '训练中...';
  } else if (isModelTrained) {
    UI.neuralStatusElement.textContent = '模型已训练完成，可以使用';
    UI.trainModelButton.disabled = false;
    UI.trainModelButton.textContent = '重新训练';
  } else {
    UI.neuralStatusElement.textContent = '模型尚未训练，点击训练按钮开始';
    UI.trainModelButton.disabled = false;
    UI.trainModelButton.textContent = '训练模型';
  }
}

/**
 * 更新训练进度
 * @param {Object} data - 进度数据
 */
function updateTrainingProgress(data) {
  if (!data) return;
  
  const { epoch, totalEpochs, loss, accuracy } = data;
  
  // 更新进度条
  const percent = (epoch / totalEpochs) * 100;
  UI.trainingBarElement.style.width = `${percent}%`;
  
  // 更新状态文本
  UI.neuralStatusElement.textContent = `训练中(${epoch}/${totalEpochs}): 损失=${loss}, 准确率=${accuracy}`;
}

/**
 * 处理训练完成
 * @param {Object} message - 训练完成消息
 */
function handleTrainingComplete(message) {
  UI.trainModelButton.disabled = false;
  
  if (message.success) {
    UI.neuralStatusElement.textContent = '模型训练完成，可以使用';
    UI.trainModelButton.textContent = '重新训练';
  } else {
    UI.neuralStatusElement.textContent = `训练失败: ${message.error || '未知错误'}`;
    UI.trainModelButton.textContent = '重试训练';
  }
} 