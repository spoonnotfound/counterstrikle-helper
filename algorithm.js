/**
 * Counterstrikle Helper 算法模块
 * 用于计算最佳猜测和处理游戏反馈
 */

// 定义常量
const ATTRIBUTES = {
  NATIONALITY: 'nationality',
  AGE: 'age',
  MAJOR_APPEARANCES: 'majorAppearances',
  TEAM: 'team',
  ROLE: 'role',
  REGION: 'region'
};

// 定义类型的常量
const FEEDBACK_RESULTS = {
  CORRECT: 'CORRECT',
  INCORRECT: 'INCORRECT',
  HIGH_CLOSE: 'HIGH_CLOSE',
  LOW_CLOSE: 'LOW_CLOSE',
  HIGH_NOT_CLOSE: 'HIGH_NOT_CLOSE',
  LOW_NOT_CLOSE: 'LOW_NOT_CLOSE',
  INCORRECT_CLOSE: 'INCORRECT_CLOSE'
};

class Algorithm {
  // 需要比较的属性
  static ATTRIBUTES_TO_COMPARE = [
    ATTRIBUTES.NATIONALITY,
    ATTRIBUTES.AGE,
    ATTRIBUTES.MAJOR_APPEARANCES,
    ATTRIBUTES.TEAM,
    ATTRIBUTES.ROLE,
    ATTRIBUTES.REGION
  ];
  
  // 缓存上次猜测信息
  static lastGuessId = null;
  static consecutiveGuessCounts = 0;
  
  /**
   * 找到最佳猜测
   * @param {Array} candidates - 候选选手
   * @param {Array} allPlayers - 所有选手
   * @param {Array} attributesToCompare - 要比较的属性
   * @returns {Object|null} - 最佳猜测的选手
   */
  static findBestGuess(candidates, allPlayers, attributesToCompare = this.ATTRIBUTES_TO_COMPARE) {
    if (!candidates || candidates.length === 0) {
      console.error('没有可用的候选人');
      return null;
    }
    
    // 如果只有一个候选人，直接返回
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // 特殊情况处理：两个候选人且属性相同
    if (candidates.length === 2) {
      const [player1, player2] = candidates;
      
      // 检查两个选手的关键属性是否完全相同
      const allAttributesSame = attributesToCompare.every(attr => 
        player1[attr] === player2[attr]
      );
      
      // 如果属性完全相同，且已经连续猜测了同一个选手，则轮换选择
      if (allAttributesSame && this.consecutiveGuessCounts >= 1) {
        const nextGuess = this.lastGuessId === player1.id ? player2 : player1;
        console.log(`检测到循环猜测，轮换到另一个选手: ${nextGuess.nickname}`);
        this.lastGuessId = nextGuess.id;
        this.consecutiveGuessCounts = 0; // 重置计数
        return nextGuess;
      }
    }
    
    // 使用信息熵方法计算每个候选人作为猜测的价值
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
      if (this.lastGuessId && this.consecutiveGuessCounts >= 1) {
        // 排除上次猜测的选手
        const filteredCandidates = bestCandidates.filter(p => p.id !== this.lastGuessId);
        if (filteredCandidates.length > 0) {
          // 从剩余候选人中随机选择一个
          const randomIndex = Math.floor(Math.random() * filteredCandidates.length);
          const nextGuess = filteredCandidates[randomIndex];
          console.log(`避免重复猜测，选择新的候选人: ${nextGuess.nickname}`);
          this.lastGuessId = nextGuess.id;
          this.consecutiveGuessCounts = 0; // 重置计数
          return nextGuess;
        }
      }
      
      // 随机选择一个最佳候选人
      const randomIndex = Math.floor(Math.random() * bestCandidates.length);
      const selectedGuess = bestCandidates[randomIndex];
      
      // 更新猜测历史
      this.updateGuessHistory(selectedGuess.id);
      
      return selectedGuess;
    } else {
      // 只有一个最佳候选人
      const bestGuess = bestCandidates[0];
      
      // 更新猜测历史
      this.updateGuessHistory(bestGuess.id);
      
      return bestGuess;
    }
  }
  
  /**
   * 更新猜测历史
   * @param {string} guessId - 猜测的选手ID
   */
  static updateGuessHistory(guessId) {
    if (this.lastGuessId === guessId) {
      this.consecutiveGuessCounts++;
    } else {
      this.lastGuessId = guessId;
      this.consecutiveGuessCounts = 0;
    }
  }
  
  /**
   * 计算猜测分数
   * @param {Object} player - 要评估的选手
   * @param {Array} candidates - 候选选手列表
   * @param {Array} attributesToCompare - 要比较的属性列表
   * @returns {number} - 猜测分数
   */
  static calculateGuessScore(player, candidates, attributesToCompare) {
    let score = 0;
    
    // 根据属性分布计算分数
    for (const attr of attributesToCompare) {
      // 统计有多少候选人与当前玩家在这个属性上相同
      let matchCount = 0;
      
      for (const candidate of candidates) {
        if (candidate.id !== player.id) {
          if (this.compareAttribute(player, candidate, attr) === FEEDBACK_RESULTS.CORRECT) {
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
  }
  
  /**
   * 比较两个选手的特定属性
   * @param {Object} player1 - 第一个选手
   * @param {Object} player2 - 第二个选手
   * @param {string} attribute - 要比较的属性
   * @returns {string} - 比较结果
   */
  static compareAttribute(player1, player2, attribute) {
    // 处理不同的属性比较逻辑
    switch (attribute) {
      case ATTRIBUTES.NATIONALITY:
        return player1.nationality === player2.nationality 
          ? FEEDBACK_RESULTS.CORRECT 
          : FEEDBACK_RESULTS.INCORRECT;
          
      case ATTRIBUTES.AGE:
        if (player1.age === player2.age) {
          return FEEDBACK_RESULTS.CORRECT;
        }
        const ageDiff = Math.abs(player1.age - player2.age);
        if (player1.age > player2.age) {
          return ageDiff <= 2 ? FEEDBACK_RESULTS.HIGH_CLOSE : FEEDBACK_RESULTS.HIGH_NOT_CLOSE;
        }
        return ageDiff <= 2 ? FEEDBACK_RESULTS.LOW_CLOSE : FEEDBACK_RESULTS.LOW_NOT_CLOSE;
        
      case ATTRIBUTES.MAJOR_APPEARANCES:
        if (player1.majorAppearances === player2.majorAppearances) {
          return FEEDBACK_RESULTS.CORRECT;
        }
        const majorDiff = Math.abs(player1.majorAppearances - player2.majorAppearances);
        if (player1.majorAppearances > player2.majorAppearances) {
          return majorDiff <= 1 ? FEEDBACK_RESULTS.HIGH_CLOSE : FEEDBACK_RESULTS.HIGH_NOT_CLOSE;
        }
        return majorDiff <= 1 ? FEEDBACK_RESULTS.LOW_CLOSE : FEEDBACK_RESULTS.LOW_NOT_CLOSE;
        
      case ATTRIBUTES.TEAM:
      case ATTRIBUTES.ROLE:
      case ATTRIBUTES.REGION:
        return player1[attribute] === player2[attribute] 
          ? FEEDBACK_RESULTS.CORRECT 
          : FEEDBACK_RESULTS.INCORRECT;
          
      default:
        return FEEDBACK_RESULTS.INCORRECT;
    }
  }
  
  /**
   * 处理游戏反馈
   * @param {Object} feedback - 游戏反馈数据
   * @param {Array} attributesToCompare - 要比较的属性列表
   * @returns {Object|null} - 处理后的反馈结果
   */
  static processGameFeedback(feedback, attributesToCompare = this.ATTRIBUTES_TO_COMPARE) {
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
          result[attr] = FEEDBACK_RESULTS.INCORRECT; // 默认为不正确
        }
      }
    }
    
    console.log('处理后的反馈结果:', result);
    return result;
  }
  
  /**
   * 根据反馈过滤候选人
   * @param {Array} candidates - 候选选手列表
   * @param {Object} lastGuess - 上次猜测的选手
   * @param {Object} feedback - 游戏反馈
   * @param {Array} attributesToCompare - 要比较的属性列表
   * @returns {Array} - 过滤后的候选选手列表
   */
  static filterCandidates(candidates, lastGuess, feedback, attributesToCompare = this.ATTRIBUTES_TO_COMPARE) {
    if (!candidates || !lastGuess || !feedback) {
      console.log('过滤条件不满足，返回原始候选人');
      return candidates;
    }
    
    console.log('开始过滤候选人，反馈:', feedback);
    console.log('当前候选人数量:', candidates.length);
    
    // 根据各属性反馈过滤候选人
    const result = candidates.filter(candidate => {
      // 检查每个属性是否符合反馈
      for (const attr of attributesToCompare) {
        const feedbackResult = feedback[attr];
        if (!feedbackResult) continue; // 没有这个属性的反馈，跳过
        
        if (attr === ATTRIBUTES.AGE || attr === ATTRIBUTES.MAJOR_APPEARANCES) {
          // 数值型属性的特殊处理
          if (!this.matchesNumericAttribute(candidate, lastGuess, attr, feedbackResult)) {
            return false;
          }
        } else if (attr === ATTRIBUTES.NATIONALITY) {
          // 国籍的特殊处理
          if (!this.matchesNationalityAttribute(candidate, lastGuess, feedbackResult)) {
            return false;
          }
        } else {
          // 其他属性的处理(team, role, region)
          if (!this.matchesSimpleAttribute(candidate, lastGuess, attr, feedbackResult)) {
            return false;
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
      return this.fallbackFilter(candidates, lastGuess, feedback);
    }
    
    return result;
  }
  
  /**
   * 检查数值型属性是否符合反馈
   * @param {Object} candidate - 候选选手
   * @param {Object} lastGuess - 上次猜测的选手
   * @param {string} attr - 属性名称
   * @param {string} feedbackResult - 反馈结果
   * @returns {boolean} - 是否符合
   */
  static matchesNumericAttribute(candidate, lastGuess, attr, feedbackResult) {
    const diff = attr === ATTRIBUTES.AGE ? 2 : 1; // 年龄差2以内，major差1以内算接近
    
    switch (feedbackResult) {
      case FEEDBACK_RESULTS.CORRECT:
        // 如果反馈是完全正确，则候选人的值必须等于猜测值
        return candidate[attr] === lastGuess[attr];
        
      case FEEDBACK_RESULTS.HIGH_CLOSE:
        // 猜测值稍微高了一点，所以候选人值应该低一点但很接近
        return lastGuess[attr] - diff <= candidate[attr] && candidate[attr] < lastGuess[attr];
        
      case FEEDBACK_RESULTS.LOW_CLOSE:
        // 猜测值稍微低了一点，所以候选人值应该高一点但很接近
        return lastGuess[attr] < candidate[attr] && candidate[attr] <= lastGuess[attr] + diff;
        
      case FEEDBACK_RESULTS.HIGH_NOT_CLOSE:
        // 猜测值太高了，所以候选人值应该远低于猜测值
        return candidate[attr] < lastGuess[attr] - diff;
        
      case FEEDBACK_RESULTS.LOW_NOT_CLOSE:
        // 猜测值太低了，所以候选人值应该远高于猜测值
        return candidate[attr] > lastGuess[attr] + diff;
        
      default:
        return true; // 未知反馈，不过滤
    }
  }
  
  /**
   * 检查国籍属性是否符合反馈
   * @param {Object} candidate - 候选选手
   * @param {Object} lastGuess - 上次猜测的选手
   * @param {string} feedbackResult - 反馈结果
   * @returns {boolean} - 是否符合
   */
  static matchesNationalityAttribute(candidate, lastGuess, feedbackResult) {
    switch (feedbackResult) {
      case FEEDBACK_RESULTS.CORRECT:
        // 如果反馈是正确的，则候选人的值必须与猜测值相同
        return candidate.nationality === lastGuess.nationality;
        
      case FEEDBACK_RESULTS.INCORRECT_CLOSE:
        // INCORRECT_CLOSE 在国籍中表示不同国家但同一大洲
        // 候选人国籍与猜测不同，但应该是同一大洲
        return candidate.nationality !== lastGuess.nationality && 
               candidate.region === lastGuess.region;
               
      case FEEDBACK_RESULTS.INCORRECT:
        // 完全不匹配，国籍不同（与大洲无关）
        return candidate.nationality !== lastGuess.nationality;
        
      default:
        return true; // 未知反馈，不过滤
    }
  }
  
  /**
   * 检查简单属性是否符合反馈
   * @param {Object} candidate - 候选选手
   * @param {Object} lastGuess - 上次猜测的选手
   * @param {string} attr - 属性名称
   * @param {string} feedbackResult - 反馈结果
   * @returns {boolean} - 是否符合
   */
  static matchesSimpleAttribute(candidate, lastGuess, attr, feedbackResult) {
    switch (feedbackResult) {
      case FEEDBACK_RESULTS.CORRECT:
        // 如果反馈是正确的，则候选人的值必须与猜测值相同
        return candidate[attr] === lastGuess[attr];
        
      case FEEDBACK_RESULTS.INCORRECT:
        // 如果反馈是不正确的，则候选人的值必须与猜测值不同
        return candidate[attr] !== lastGuess[attr];
        
      default:
        return true; // 未知反馈，不过滤
    }
  }
  
  /**
   * 后备过滤方法，只使用最可靠的属性过滤
   * @param {Array} candidates - 候选选手列表
   * @param {Object} lastGuess - 上次猜测的选手
   * @param {Object} feedback - 游戏反馈
   * @returns {Array} - 过滤后的候选选手列表
   */
  static fallbackFilter(candidates, lastGuess, feedback) {
    console.log('使用后备过滤方法');
    // 只使用team属性进行过滤，因为这通常是最可靠的
    if (feedback.team === FEEDBACK_RESULTS.CORRECT) {
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
}

// 为了旧的加载方式兼容
window.AlgorithmModule = Algorithm;

// 作为ES模块导出
export default Algorithm; 