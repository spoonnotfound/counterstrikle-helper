// 修改为ES模块格式
const AlgorithmModule = {
  // 需要比较的属性
  ATTRIBUTES_TO_COMPARE: ['nationality', 'age', 'majorAppearances', 'team', 'role', 'region'],
  
  // 找到最佳猜测
  findBestGuess: function(candidates, allPlayers, attributesToCompare) {
    if (!candidates || candidates.length === 0) {
      console.error('没有可用的候选人');
      return null;
    }
    
    // 如果只有一个候选人，直接返回
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // 检查是否在循环猜测同一个选手，通过检查之前的猜测历史
    // 全局变量记录上次猜测的选手ID和连续猜测相同选手的次数
    if (!window.lastGuessId) {
      window.lastGuessId = null;
      window.consecutiveGuessCounts = 0;
    }
    
    // 如果只有两个选手且所有比较属性相同，可能会陷入循环
    if (candidates.length === 2) {
      const player1 = candidates[0];
      const player2 = candidates[1];
      
      // 检查两个选手的关键属性是否完全相同
      let allAttributesSame = true;
      for (const attr of attributesToCompare) {
        if (player1[attr] !== player2[attr]) {
          allAttributesSame = false;
          break;
        }
      }
      
      // 如果属性完全相同，且已经连续猜测了同一个选手，则轮换选择
      if (allAttributesSame && window.consecutiveGuessCounts >= 1) {
        // 如果上次猜测的是第一个选手，这次选第二个，反之亦然
        const nextGuess = window.lastGuessId === player1.id ? player2 : player1;
        console.log(`检测到循环猜测，轮换到另一个选手: ${nextGuess.nickname}`);
        window.lastGuessId = nextGuess.id;
        window.consecutiveGuessCounts = 0; // 重置计数
        return nextGuess;
      }
    }
    
    // 使用简单的信息熵方法计算每个候选人作为猜测的价值
    let bestScore = -Infinity;
    let bestCandidates = [];
    
    for (const player of candidates) {
      // 计算这个玩家作为猜测的分数
      const score = this.calculateGuessScore(player, candidates, attributesToCompare);
      
      // 记录最高分和所有获得最高分的选手
      if (score > bestScore) {
        bestScore = score;
        bestCandidates = [player];
      } else if (Math.abs(score - bestScore) < 0.0001) { // 允许微小的浮点数误差
        bestCandidates.push(player);
      }
    }
    
    // 如果有多个最佳候选人，应用选择策略
    if (bestCandidates.length > 1) {
      // 如果连续猜测同一个选手超过一定次数，避免选择它
      if (window.lastGuessId && window.consecutiveGuessCounts >= 1) {
        // 排除上次猜测的选手
        const filteredCandidates = bestCandidates.filter(p => p.id !== window.lastGuessId);
        if (filteredCandidates.length > 0) {
          // 从剩余候选人中随机选择一个
          const randomIndex = Math.floor(Math.random() * filteredCandidates.length);
          const nextGuess = filteredCandidates[randomIndex];
          console.log(`避免重复猜测，选择新的候选人: ${nextGuess.nickname}`);
          window.lastGuessId = nextGuess.id;
          window.consecutiveGuessCounts = 0; // 重置计数
          return nextGuess;
        }
      }
      
      // 随机选择一个最佳候选人
      const randomIndex = Math.floor(Math.random() * bestCandidates.length);
      const selectedGuess = bestCandidates[randomIndex];
      
      // 更新猜测历史
      if (window.lastGuessId === selectedGuess.id) {
        window.consecutiveGuessCounts++;
      } else {
        window.lastGuessId = selectedGuess.id;
        window.consecutiveGuessCounts = 0;
      }
      
      return selectedGuess;
    } else {
      // 只有一个最佳候选人
      const bestGuess = bestCandidates[0];
      
      // 更新猜测历史
      if (window.lastGuessId === bestGuess.id) {
        window.consecutiveGuessCounts++;
      } else {
        window.lastGuessId = bestGuess.id;
        window.consecutiveGuessCounts = 0;
      }
      
      return bestGuess;
    }
  },
  
  // 计算猜测分数
  calculateGuessScore: function(player, candidates, attributesToCompare) {
    let score = 0;
    
    // 根据属性分布计算分数
    for (const attr of attributesToCompare) {
      // 统计有多少候选人与当前玩家在这个属性上相同
      let matchCount = 0;
      
      for (const candidate of candidates) {
        if (candidate.id !== player.id) {
          if (this.compareAttribute(player, candidate, attr) === 'CORRECT') {
            matchCount++;
          }
        }
      }
      
      // 计算这个属性的分数 - 理想情况是分割候选人集合为一半一半
      const idealSplit = candidates.length / 2;
      const attrScore = 1 - Math.abs(matchCount - idealSplit) / idealSplit;
      score += attrScore;
    }
    
    return score;
  },
  
  // 比较两个选手的特定属性
  compareAttribute: function(player1, player2, attribute) {
    // 处理不同的属性比较逻辑
    if (attribute === 'nationality') {
      return player1.nationality === player2.nationality ? 'CORRECT' : 'INCORRECT';
    } else if (attribute === 'age') {
      if (player1.age === player2.age) {
        return 'CORRECT';
      } else if (player1.age > player2.age) {
        return Math.abs(player1.age - player2.age) <= 2 ? 'HIGH_CLOSE' : 'HIGH_NOT_CLOSE';
      } else {
        return Math.abs(player1.age - player2.age) <= 2 ? 'LOW_CLOSE' : 'LOW_NOT_CLOSE';
      }
    } else if (attribute === 'majorAppearances') {
      if (player1.majorAppearances === player2.majorAppearances) {
        return 'CORRECT';
      } else if (player1.majorAppearances > player2.majorAppearances) {
        return Math.abs(player1.majorAppearances - player2.majorAppearances) <= 1 ? 'HIGH_CLOSE' : 'HIGH_NOT_CLOSE';
      } else {
        return Math.abs(player1.majorAppearances - player2.majorAppearances) <= 1 ? 'LOW_CLOSE' : 'LOW_NOT_CLOSE';
      }
    } else if (attribute === 'team') {
      return player1.team === player2.team ? 'CORRECT' : 'INCORRECT';
    } else if (attribute === 'role') {
      return player1.role === player2.role ? 'CORRECT' : 'INCORRECT';
    } else if (attribute === 'region') {
      return player1.region === player2.region ? 'CORRECT' : 'INCORRECT';
    }
    
    return 'INCORRECT';
  },
  
  // 处理游戏反馈
  processGameFeedback: function(feedback, attributesToCompare) {
    if (!feedback || !feedback.feedback) {
      return null;
    }
    
    const result = {};
    
    // 处理每个属性的反馈
    for (const attr of attributesToCompare) {
      const attrFeedback = feedback.feedback[attr];
      
      if (attrFeedback) {
        // 处理不同格式的反馈
        if (typeof attrFeedback === 'string') {
          // 直接是结果字符串
          result[attr] = attrFeedback;
        } else if (attrFeedback.result) {
          // 对象格式，包含result字段
          result[attr] = attrFeedback.result;
        } else if (attrFeedback.value !== undefined) {
          // 包含value但没有result，尝试推断
          result[attr] = 'INCORRECT'; // 默认为不正确
        }
      }
    }
    
    console.log('处理后的反馈结果:', result);
    return result;
  },
  
  // 根据反馈过滤候选人（修复版本）
  filterCandidates: function(candidates, lastGuess, feedback, attributesToCompare) {
    if (!candidates || !lastGuess || !feedback) {
      console.log('过滤条件不满足，返回原始候选人');
      return candidates;
    }
    
    console.log('开始过滤候选人，反馈:', feedback);
    console.log('当前候选人数量:', candidates.length);
    
    // 先移除上一次猜测的选手
    const filteredCandidates = candidates;
    
    // 根据各属性反馈过滤候选人
    const result = filteredCandidates.filter(candidate => {
      // 检查每个属性是否符合反馈
      for (const attr of attributesToCompare) {
        const feedbackResult = feedback[attr];
        if (!feedbackResult) continue; // 没有这个属性的反馈，跳过
        
        if (attr === 'age' || attr === 'majorAppearances') {
          // 数值型属性的特殊处理
          if (feedbackResult === 'CORRECT') {
            // 如果反馈是完全正确，则候选人的值必须等于猜测值
            if (candidate[attr] !== lastGuess[attr]) {
              return false;
            }
          } else if (feedbackResult === 'HIGH_CLOSE') {
            // 猜测值稍微高了一点，所以候选人值应该低一点但很接近
            const diff = attr === 'age' ? 2 : 1; // 年龄差2以内，major差1以内算接近
            if (!(lastGuess[attr] - diff <= candidate[attr] && candidate[attr] < lastGuess[attr])) {
              return false;
            }
          } else if (feedbackResult === 'LOW_CLOSE') {
            // 猜测值稍微低了一点，所以候选人值应该高一点但很接近
            const diff = attr === 'age' ? 2 : 1; // 年龄差2以内，major差1以内算接近
            if (!(lastGuess[attr] < candidate[attr] && candidate[attr] <= lastGuess[attr] + diff)) {
              return false;
            }
          } else if (feedbackResult === 'HIGH_NOT_CLOSE') {
            // 猜测值太高了，所以候选人值应该远低于猜测值
            const diff = attr === 'age' ? 2 : 1;
            if (!(candidate[attr] < lastGuess[attr] - diff)) {
              return false;
            }
          } else if (feedbackResult === 'LOW_NOT_CLOSE') {
            // 猜测值太低了，所以候选人值应该远高于猜测值
            const diff = attr === 'age' ? 2 : 1;
            if (!(candidate[attr] > lastGuess[attr] + diff)) {
              return false;
            }
          }
        } else if (attr === 'nationality') {
          // 国籍的特殊处理
          if (feedbackResult === 'CORRECT') {
            // 如果反馈是正确的，则候选人的值必须与猜测值相同
            if (candidate[attr] !== lastGuess[attr]) {
              return false;
            }
          } else if (feedbackResult === 'INCORRECT_CLOSE') {
            // INCORRECT_CLOSE 在国籍中表示不同国家但同一大洲
            // 候选人国籍与猜测不同，但应该是同一大洲
            if (candidate[attr] === lastGuess[attr] || candidate.region !== lastGuess.region) {
              return false;
            }
          } else if (feedbackResult === 'INCORRECT') {
            // 完全不匹配，国籍不同（与大洲无关）
            if (candidate[attr] === lastGuess[attr]) {
              return false;
            }
          }
        } else {
          // 其他属性的处理(team, role, region)
          if (feedbackResult === 'CORRECT') {
            // 如果反馈是正确的，则候选人的值必须与猜测值相同
            if (candidate[attr] !== lastGuess[attr]) {
              return false;
            }
          } else if (feedbackResult === 'INCORRECT') {
            // 如果反馈是不正确的，则候选人的值必须与猜测值不同
            if (candidate[attr] === lastGuess[attr]) {
              return false;
            }
          }
        }
      }
      
      // 所有条件都满足，保留这个候选人
      return true;
    });
    
    console.log('过滤后的候选人数量:', result.length);
    
    // 如果过滤后没有候选人，返回一个后备集合
    if (result.length === 0) {
      console.warn('过滤后没有候选人，尝试宽松条件再次过滤');
      return this.fallbackFilter(filteredCandidates, lastGuess, feedback);
    }
    
    return result;
  },
  
  // 后备过滤方法，只使用最可靠的属性过滤
  fallbackFilter: function(candidates, lastGuess, feedback) {
    console.log('使用后备过滤方法');
    // 只使用team属性进行过滤，因为这通常是最可靠的
    if (feedback.team === 'CORRECT') {
      const result = candidates.filter(c => c.team === lastGuess.team);
      if (result.length > 0) {
        console.log('通过team过滤后的候选人数量:', result.length);
        return result;
      }
    }
    
    // 如果过滤后仍然没有候选人，或者team反馈不是CORRECT，返回所有候选人
    console.warn('后备过滤失败，返回所有候选人');
    return candidates;
  }
};

// 为了旧的加载方式兼容
window.AlgorithmModule = AlgorithmModule;

// 作为ES模块导出
export default AlgorithmModule; 