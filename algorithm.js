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

// 定义反馈类型的常量
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
   * 计算信息熵: H(S) = log2(|S|)
   * @param {Array} items - 项目列表
   * @returns {number} - 熵值
   */
  static calculateEntropy(items) {
    const n = items.length;
    if (n <= 1) {
      return 0.0;  // 当剩余0或1个项目时，不确定性为0
    }
    return Math.log2(n);  // 返回以2为底的对数值作为熵
  }
  
  /**
   * 获取完整的反馈元组，与Python版本get_feedback一致
   * @param {Object} guessPlayer - 猜测的选手
   * @param {Object} actualPlayer - 实际的目标选手
   * @param {Array} attributes - 要比较的属性
   * @returns {Array} - 反馈元组
   */
  static getCompleteFeedback(guessPlayer, actualPlayer, attributes) {
    const feedback = [];
    
    for (const attr of attributes) {
      if (!guessPlayer[attr] || !actualPlayer[attr]) {
        feedback.push('unknown_attribute');
        continue;
      }
      
      if (attr === ATTRIBUTES.AGE) {
        const diff = actualPlayer[attr] - guessPlayer[attr];
        if (diff === 0) {
          feedback.push('correct');
        } else if (diff > 2) {
          feedback.push('too_low');  // 猜测值过低
        } else if (diff < -2) {
          feedback.push('too_high');  // 猜测值过高
        } else if (0 < diff && diff <= 2) {
          feedback.push('slightly_low');  // 猜测值略低
        } else if (-2 <= diff && diff < 0) {
          feedback.push('slightly_high');  // 猜测值略高
        }
      } else if (attr === ATTRIBUTES.MAJOR_APPEARANCES) {
        const diff = actualPlayer[attr] - guessPlayer[attr];
        if (diff === 0) {
          feedback.push('correct');
        } else if (diff > 1) {
          feedback.push('too_low');  // 猜测值过低
        } else if (diff < -1) {
          feedback.push('too_high');  // 猜测值过高
        } else if (diff === 1) {
          feedback.push('slightly_low');  // 猜测值略低
        } else if (diff === -1) {
          feedback.push('slightly_high');  // 猜测值略高
        }
      } else {
        // 非数值型属性
        if (guessPlayer[attr] === actualPlayer[attr]) {
          feedback.push('correct');
        } else {
          feedback.push('incorrect');
        }
      }
    }
    
    // 返回反馈元组，在JS中用数组表示
    return feedback;
  }
  
  /**
   * 使用Python版本的信息熵方法找到最佳猜测
   * @param {Array} candidates - 候选选手列表
   * @param {Array} allPlayers - 所有选手列表
   * @param {Array} attributesToCompare - 要比较的属性列表
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
    
    let minExpectedEntropy = Infinity;
    let bestGuess = null;
    const numCandidates = candidates.length;
    
    console.log(`开始寻找最佳猜测，当前候选人数量: ${numCandidates}`);
    
    // 特殊情况处理：两个候选人且已经连续猜测同一个多次
    if (candidates.length === 2 && this.lastGuessId && this.consecutiveGuessCounts >= 1) {
      const otherCandidate = candidates.find(c => c.id !== this.lastGuessId);
      if (otherCandidate) {
        console.log(`只有两个候选人且连续猜测多次，选择不同的: ${otherCandidate.nickname}`);
        this.lastGuessId = otherCandidate.id;
        this.consecutiveGuessCounts = 0;
        return otherCandidate;
      }
    }
    
    // 遍历所有候选人作为可能的猜测
    for (const guessCandidate of candidates) {
      // 模拟猜测这个候选人的所有可能结果
      const outcomes = {};
      
      for (const possibleTarget of candidates) {
        // 获取如果possibleTarget是实际目标时的反馈
        const feedback = this.getCompleteFeedback(guessCandidate, possibleTarget, attributesToCompare);
        const feedbackKey = JSON.stringify(feedback); // 将反馈数组转为字符串作为键
        
        if (!outcomes[feedbackKey]) {
          outcomes[feedbackKey] = [];
        }
        outcomes[feedbackKey].push(possibleTarget);
      }
      
      // 计算期望熵
      let expectedEntropy = 0.0;
      for (const feedbackKey in outcomes) {
        const subset = outcomes[feedbackKey];
        const subsetSize = subset.length;
        
        if (subsetSize > 0) {
          const probability = subsetSize / numCandidates;
          const subsetEntropy = this.calculateEntropy(subset);
          expectedEntropy += probability * subsetEntropy;
        }
      }
      
      // Debug信息
      console.log(`候选人 ${guessCandidate.nickname}, 期望熵: ${expectedEntropy.toFixed(4)}`);
      
      // 更新最佳猜测（选择期望熵最小的）
      if (expectedEntropy < minExpectedEntropy) {
        minExpectedEntropy = expectedEntropy;
        bestGuess = guessCandidate;
      } else if (Math.abs(expectedEntropy - minExpectedEntropy) < 0.0001) {
        // 处理平局情况 - 如果连续猜测相同选手，优先选择不同选手
        if (this.lastGuessId && guessCandidate.id !== this.lastGuessId && 
            (bestGuess === null || bestGuess.id === this.lastGuessId)) {
          console.log(`平局情况，选择不同于上次猜测的: ${guessCandidate.nickname}`);
          bestGuess = guessCandidate;
        }
      }
    }
    
    // 更新猜测历史
    if (bestGuess) {
      if (this.lastGuessId === bestGuess.id) {
        this.consecutiveGuessCounts++;
      } else {
        this.lastGuessId = bestGuess.id;
        this.consecutiveGuessCounts = 0;
      }
      console.log(`最佳猜测: ${bestGuess.nickname}, 期望熵: ${minExpectedEntropy.toFixed(4)}, 连续次数: ${this.consecutiveGuessCounts}`);
    }
    
    return bestGuess;
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
   * 将外部反馈格式转换为内部使用的格式
   * @param {Object} feedback - 外部反馈格式
   * @returns {Object} - 标准化后的反馈
   */
  static normalizeGameFeedback(feedback) {
    const normalized = {};
    
    for (const attr in feedback) {
      const value = feedback[attr];
      
      // 统一转换为内部使用的反馈格式
      if (value === FEEDBACK_RESULTS.CORRECT) {
        normalized[attr] = 'correct';
      } else if (value === FEEDBACK_RESULTS.HIGH_CLOSE) {
        normalized[attr] = 'slightly_high';
      } else if (value === FEEDBACK_RESULTS.LOW_CLOSE) {
        normalized[attr] = 'slightly_low';
      } else if (value === FEEDBACK_RESULTS.HIGH_NOT_CLOSE) {
        normalized[attr] = 'too_high';
      } else if (value === FEEDBACK_RESULTS.LOW_NOT_CLOSE) {
        normalized[attr] = 'too_low';
      } else if (value === FEEDBACK_RESULTS.INCORRECT_CLOSE) {
        // 特殊情况，可能需要根据属性类型进行不同处理
        normalized[attr] = 'incorrect';
      } else {
        normalized[attr] = 'incorrect';
      }
    }
    
    return normalized;
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
    
    // 将外部反馈格式转换为内部格式
    const normalizedFeedback = this.normalizeGameFeedback(feedback);
    console.log('标准化后的反馈:', normalizedFeedback);
    
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
    
    // 如果过滤后没有候选人，直接返回原始候选人列表
    if (result.length === 0) {
      console.warn('过滤后没有候选人，返回原始候选人列表');
      return candidates;
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
   * 初始化算法状态
   */
  static init() {
    this.lastGuessId = null;
    this.consecutiveGuessCounts = 0;
    console.log('算法模块已初始化');
    return this;
  }
}

// 初始化模块
Algorithm.init();

// 为了旧的加载方式兼容
window.AlgorithmModule = Algorithm;

// 作为ES模块导出
export default Algorithm;