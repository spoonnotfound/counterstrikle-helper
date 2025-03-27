// 弹出窗口加载完成后执行
document.addEventListener('DOMContentLoaded', async () => {
  // 获取元素
  const autoPlayToggle = document.getElementById('autoPlayToggle');
  const playerCountElement = document.getElementById('playerCount');
  const gamePhaseElement = document.getElementById('gamePhase');
  const candidatesCountElement = document.getElementById('candidatesCount');
  const guessCountElement = document.getElementById('guessCount');
  const algorithmTestButton = document.getElementById('algorithmTestButton');
  const testResultsContainer = document.getElementById('testResults');
  const testProgressElement = document.getElementById('testProgress');
  const progressBarElement = document.getElementById('progressBar');
  const successRateElement = document.getElementById('successRate');
  const avgGuessesElement = document.getElementById('avgGuesses');
  
  // 从存储中加载设置
  const settings = await chrome.storage.local.get(['autoPlay']);
  autoPlayToggle.checked = settings.autoPlay || false;
  
  // 监听自动模式开关
  autoPlayToggle.addEventListener('change', () => {
    const isEnabled = autoPlayToggle.checked;
    
    // 发送消息到内容脚本
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleAutoPlay',
          value: isEnabled
        });
      }
    });
    
    // 保存设置
    chrome.storage.local.set({ autoPlay: isEnabled });
  });
  
  // 算法测试按钮点击事件
  algorithmTestButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // 向内容脚本发送全量测试命令
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'startAlgorithmTest',
          options: {
            testAll: true,
            detailed: true // 启用详细诊断信息
          }
        });
        
        // 提供用户反馈
        algorithmTestButton.textContent = '测试中...';
        algorithmTestButton.disabled = true;
        
        // 显示测试结果容器
        testResultsContainer.style.display = 'block';
      }
    });
  });
  
  // 获取玩家数据数量
  chrome.runtime.sendMessage({ action: 'getPlayerCount' }, (response) => {
    if (response && response.count) {
      playerCountElement.textContent = response.count;
    } else {
      playerCountElement.textContent = '未加载';
    }
  });
  
  // 监听来自content.js的状态更新
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
      algorithmTestButton.textContent = '算法测试';
      algorithmTestButton.disabled = false;
    }
  });
  
  // 更新算法测试进度
  function updateTestProgress(data) {
    const { current, total, successCount } = data;
    
    // 更新进度文本
    testProgressElement.textContent = `${current}/${total}`;
    
    // 更新进度条
    const percent = (current / total) * 100;
    progressBarElement.style.width = `${percent}%`;
    
    // 更新成功率
    const successRate = ((successCount / current) * 100).toFixed(1);
    successRateElement.textContent = `${successRate}%`;
  }
  
  // 更新算法测试最终结果
  function updateTestResults(results) {
    const { successCount, totalTests, totalGuesses, failedTests } = results;
    
    // 更新成功率
    const successRate = ((successCount / totalTests) * 100).toFixed(1);
    successRateElement.textContent = `${successRate}% (${successCount}/${totalTests})`;
    
    // 更新平均猜测次数
    const avgGuesses = (totalGuesses / totalTests).toFixed(1);
    avgGuessesElement.textContent = avgGuesses;
    
    // 更新失败用例列表
    const failedTestsContainer = document.getElementById('failedTestsContainer');
    const failedTestsList = document.getElementById('failedTestsList');
    
    // 清空现有内容
    failedTestsList.innerHTML = '';
    
    // 如果没有失败用例，隐藏容器
    if (!failedTests || failedTests.length === 0) {
      failedTestsContainer.style.display = 'none';
      return;
    }
    
    // 显示失败用例容器
    failedTestsContainer.style.display = 'block';
    
    // 最多显示10个失败用例
    const maxFailuresToShow = 10;
    const testsToShow = failedTests.slice(0, maxFailuresToShow);
    
    // 添加每个失败用例
    testsToShow.forEach(test => {
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
      failedTestsList.appendChild(failureItem);
    });
    
    // 如果还有更多失败用例，显示一条信息
    if (failedTests.length > maxFailuresToShow) {
      const moreFailures = document.createElement('div');
      moreFailures.className = 'more-failures';
      moreFailures.textContent = `还有 ${failedTests.length - maxFailuresToShow} 个失败用例未显示`;
      failedTestsList.appendChild(moreFailures);
    }
  }
  
  // 根据状态更新UI
  function updateUIWithStatus(status) {
    // 更新界面显示
    gamePhaseElement.textContent = getGamePhaseText(status.gamePhase);
    candidatesCountElement.textContent = status.candidatesCount || '-';
    guessCountElement.textContent = status.guessCount || '-';
    
    // 更新连接状态
    if (status.connectionActive) {
      gamePhaseElement.classList.add('connected');
    } else {
      gamePhaseElement.classList.remove('connected');
    }
  }
  
  // 转换游戏阶段文本
  function getGamePhaseText(phase) {
    if (!phase) return '未检测到游戏';
    
    const phaseMap = {
      'lobby': '等待中',
      'game': '游戏进行中',
      'results': '游戏结束'
    };
    
    return phaseMap[phase] || phase;
  }
  
  // 显示弹出窗口已加载消息
  console.log('弹出窗口已加载');
}); 