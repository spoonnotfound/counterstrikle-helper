/**
 * Counterstrikle Helper 神经网络算法模块
 * 基于强化学习和神经网络实现智能猜测
 */

// 导入原始算法中的常量定义
import Algorithm from './algorithm.js';

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

/**
 * 检查TensorFlow.js是否已加载到页面环境中
 * @returns {boolean} TensorFlow.js是否可用
 */
function isTensorFlowAvailable() {
  return typeof window !== 'undefined' && window.tf !== undefined;
}

/**
 * 获取TensorFlow.js对象
 * @returns {Object|null} TensorFlow.js对象或null
 */
function getTensorFlow() {
  if (isTensorFlowAvailable()) {
    return window.tf;
  }
  return null;
}

class NeuralAlgorithm {
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
  
  // 神经网络模型
  static model = null;
  static isModelTrained = false;
  static isTraining = false;
  
  // 数据处理和特征工程
  static attributeEncoders = {};
  static featureSize = 0;
  
  /**
   * 初始化神经网络
   * @param {boolean} forceReset - 是否强制重新初始化
   */
  static async initNeuralNetwork(forceReset = false) {
    if (this.model && !forceReset) {
      console.log('神经网络模型已存在，跳过初始化');
      return;
    }
    
    console.log('初始化神经网络模型...');
    
    // 获取TensorFlow.js对象
    const tf = getTensorFlow();
    if (!tf) {
      throw new Error('TensorFlow.js未加载或不可用，请确保页面已正确加载TensorFlow');
    }
    
    // 创建模型
    this.model = tf.sequential();
    
    // 添加层
    // 输入层 -> 隐藏层 -> 输出层
    this.model.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      inputShape: [this.featureSize || 50]  // 特征数量，将在训练前确定
    }));
    
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    this.model.add(tf.layers.dropout({ rate: 0.2 }));
    
    this.model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    // 输出层 - 预测每个选手是目标的概率
    this.model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));
    
    // 编译模型
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log('神经网络模型初始化完成');
  }
  
  /**
   * 动态加载TensorFlow.js
   * @returns {Promise} - 加载完成的Promise
   */
  static loadTensorFlow() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('tensorflow.min.js');
      script.onload = () => {
        console.log('TensorFlow.js加载成功');
        resolve();
      };
      script.onerror = (err) => {
        console.error('TensorFlow.js加载失败:', err);
        reject(err);
      };
      document.head.appendChild(script);
    });
  }
  
  /**
   * 特征编码器初始化
   * @param {Array} allPlayers - 所有选手列表
   */
  static initEncoders(allPlayers) {
    console.log('初始化特征编码器...');
    
    // 收集所有可能的属性值
    const uniqueValues = {
      nationality: new Set(),
      region: new Set(),
      team: new Set(),
      role: new Set(),
      age: new Set(),
      majorAppearances: new Set()
    };
    
    // 遍历所有选手，收集唯一值
    allPlayers.forEach(player => {
      Object.keys(uniqueValues).forEach(attr => {
        if (player[attr] !== undefined) {
          uniqueValues[attr].add(player[attr]);
        }
      });
    });
    
    // 创建编码器
    this.attributeEncoders = {};
    let featureCount = 0;
    
    // 分类特征的one-hot编码
    ['nationality', 'region', 'team', 'role'].forEach(attr => {
      const values = Array.from(uniqueValues[attr]);
      this.attributeEncoders[attr] = {
        type: 'categorical',
        values: values,
        encode: (value) => {
          const encoded = new Array(values.length).fill(0);
          const index = values.indexOf(value);
          if (index !== -1) {
            encoded[index] = 1;
          }
          return encoded;
        }
      };
      featureCount += values.length;
    });
    
    // 数值特征的归一化
    ['age', 'majorAppearances'].forEach(attr => {
      const values = Array.from(uniqueValues[attr]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      this.attributeEncoders[attr] = {
        type: 'numerical',
        min: min,
        max: max,
        encode: (value) => {
          return [(value - min) / (max - min || 1)];
        }
      };
      featureCount += 1;
    });
    
    // 设置特征大小
    this.featureSize = featureCount;
    console.log(`特征编码器初始化完成，特征维度: ${featureCount}`);
  }
  
  /**
   * 特征编码 - 将选手对象转换为特征向量
   * @param {Object} player - 选手对象
   * @returns {Array} - 特征向量
   */
  static encodePlayer(player) {
    if (!this.attributeEncoders || Object.keys(this.attributeEncoders).length === 0) {
      console.error('特征编码器尚未初始化');
      return [];
    }
    
    let features = [];
    
    // 编码每个属性
    for (const attr in this.attributeEncoders) {
      const encoder = this.attributeEncoders[attr];
      const value = player[attr];
      
      if (value !== undefined) {
        const encoded = encoder.encode(value);
        features = features.concat(encoded);
      } else {
        // 处理缺失值
        const padding = new Array(
          encoder.type === 'categorical' ? encoder.values.length : 1
        ).fill(0);
        features = features.concat(padding);
      }
    }
    
    return features;
  }
  
  /**
   * 通过过去的猜测和反馈生成训练数据
   * @param {Array} guessHistory - 猜测历史记录
   * @returns {Object} - 训练数据
   */
  static generateTrainingData(guessHistory, allPlayers) {
    console.log('生成训练数据...');
    
    if (!guessHistory || guessHistory.length === 0) {
      console.error('没有猜测历史，无法生成训练数据');
      return { inputs: [], labels: [] };
    }
    
    // 初始化编码器(如果需要)
    if (!this.attributeEncoders || Object.keys(this.attributeEncoders).length === 0) {
      this.initEncoders(allPlayers);
    }
    
    const inputs = [];
    const labels = [];
    
    // 遍历猜测历史
    guessHistory.forEach(history => {
      const { guessPlayer, feedback, actualPlayer } = history;
      
      // 编码猜测的选手
      const playerFeatures = this.encodePlayer(guessPlayer);
      
      // 为每个选手生成标签（是否为目标）
      const label = guessPlayer.id === actualPlayer.id ? 1 : 0;
      
      inputs.push(playerFeatures);
      labels.push(label);
    });
    
    console.log(`生成了 ${inputs.length} 条训练数据`);
    return { inputs, labels };
  }
  
  /**
   * 训练神经网络模型
   * @param {Array} guessHistory - 猜测历史记录
   * @param {Array} allPlayers - 所有选手列表 
   */
  static async trainModel(guessHistory, allPlayers) {
    if (this.isTraining) {
      console.log('模型正在训练中，请稍后再试');
      return;
    }
    
    this.isTraining = true;
    console.log('开始训练神经网络模型...');
    
    try {
      // 获取TensorFlow.js对象
      const tf = getTensorFlow();
      if (!tf) {
        throw new Error('TensorFlow.js未加载或不可用，请确保页面已正确加载TensorFlow');
      }
      
      // 初始化模型(如果需要)
      await this.initNeuralNetwork();
      
      // 生成训练数据
      const { inputs, labels } = this.generateTrainingData(guessHistory, allPlayers);
      
      if (inputs.length === 0) {
        console.error('没有训练数据');
        this.isTraining = false;
        return;
      }
      
      // 转换为张量
      const xs = tf.tensor2d(inputs);
      const ys = tf.tensor2d(labels, [labels.length, 1]);
      
      // 训练配置
      const batchSize = 32;
      const epochs = 20;
      
      // 训练模型
      console.log('开始训练过程...');
      const trainingResult = await this.model.fit(xs, ys, {
        batchSize,
        epochs,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`训练周期 ${epoch + 1}/${epochs}, 损失: ${logs.loss.toFixed(4)}, 准确率: ${logs.acc.toFixed(4)}`);
            // 向UI发送更新
            if (window.chrome && chrome.runtime) {
              chrome.runtime.sendMessage({
                action: 'neuralTrainingUpdate',
                data: {
                  epoch: epoch + 1,
                  totalEpochs: epochs,
                  loss: logs.loss.toFixed(4),
                  accuracy: logs.acc.toFixed(4)
                }
              });
            }
          }
        }
      });
      
      // 释放张量内存
      xs.dispose();
      ys.dispose();
      
      console.log('模型训练完成', trainingResult);
      this.isModelTrained = true;
      
      // 通知UI训练完成
      if (window.chrome && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'neuralTrainingComplete',
          success: true
        });
      }
    } catch (error) {
      console.error('模型训练失败:', error);
      // 通知UI训练失败
      if (window.chrome && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'neuralTrainingComplete',
          success: false,
          error: error.message
        });
      }
    } finally {
      this.isTraining = false;
    }
  }
  
  /**
   * 使用神经网络预测最佳猜测
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
    
    console.log(`开始寻找最佳猜测，当前候选人数量: ${candidates.length}`);
    
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
    
    // 获取TensorFlow.js对象
    const tf = getTensorFlow();
    
    // 检查模型是否已训练和TensorFlow.js是否可用
    if (!this.model || !this.isModelTrained || !tf) {
      console.log('神经网络模型未训练或TensorFlow.js未加载，使用信息熵算法作为后备');
      return Algorithm.findBestGuess(candidates, allPlayers, attributesToCompare);
    }
    
    try {
      // 使用模型预测每个候选人的得分
      tf.tidy(() => {
        // 为每个候选人创建特征
        const candidateFeatures = candidates.map(candidate => this.encodePlayer(candidate));
        
        // 转换为张量并预测
        const inputTensor = tf.tensor2d(candidateFeatures);
        const predictions = this.model.predict(inputTensor);
        
        // 获取预测结果
        const scores = predictions.dataSync();
        
        // 将得分与候选人关联
        candidates.forEach((candidate, index) => {
          candidate.score = scores[index];
        });
      });
      
      // 按照得分排序并选择最高的
      candidates.sort((a, b) => b.score - a.score);
      
      // 如果连续选择相同的选手，考虑选择第二好的
      if (this.lastGuessId === candidates[0].id && this.consecutiveGuessCounts >= 1 && candidates.length > 1) {
        console.log(`避免连续猜测相同选手，从 ${candidates[0].nickname} 切换到 ${candidates[1].nickname}`);
        this.lastGuessId = candidates[1].id;
        this.consecutiveGuessCounts = 0;
        return candidates[1];
      }
      
      // 更新猜测历史
      if (this.lastGuessId === candidates[0].id) {
        this.consecutiveGuessCounts++;
      } else {
        this.lastGuessId = candidates[0].id;
        this.consecutiveGuessCounts = 0;
      }
      
      console.log(`神经网络选择了 ${candidates[0].nickname} 作为最佳猜测，得分: ${candidates[0].score.toFixed(4)}`);
      return candidates[0];
    } catch (error) {
      console.error('神经网络预测失败:', error);
      console.log('回退到信息熵算法');
      return Algorithm.findBestGuess(candidates, allPlayers, attributesToCompare);
    }
  }
  
  /**
   * 复用原始算法的方法
   */
  static getCompleteFeedback(guessPlayer, actualPlayer, attributes) {
    return Algorithm.getCompleteFeedback(guessPlayer, actualPlayer, attributes);
  }
  
  static compareAttribute(player1, player2, attribute) {
    return Algorithm.compareAttribute(player1, player2, attribute);
  }
  
  static processGameFeedback(feedback, attributesToCompare) {
    return Algorithm.processGameFeedback(feedback, attributesToCompare);
  }
  
  static normalizeGameFeedback(feedback) {
    return Algorithm.normalizeGameFeedback(feedback);
  }
  
  static filterCandidates(candidates, lastGuess, feedback, attributesToCompare) {
    return Algorithm.filterCandidates(candidates, lastGuess, feedback, attributesToCompare);
  }
  
  static matchesNumericAttribute(candidate, lastGuess, attr, feedbackResult) {
    return Algorithm.matchesNumericAttribute(candidate, lastGuess, attr, feedbackResult);
  }
  
  static matchesNationalityAttribute(candidate, lastGuess, feedbackResult) {
    return Algorithm.matchesNationalityAttribute(candidate, lastGuess, feedbackResult);
  }
  
  static matchesSimpleAttribute(candidate, lastGuess, attr, feedbackResult) {
    return Algorithm.matchesSimpleAttribute(candidate, lastGuess, attr, feedbackResult);
  }
  
  /**
   * 保存模型到本地存储
   */
  static async saveModel() {
    if (!this.model || !this.isModelTrained) {
      console.error('没有训练好的模型可以保存');
      return false;
    }
    
    try {
      const tf = getTensorFlow();
      if (!tf) {
        throw new Error('TensorFlow.js未加载，无法保存模型');
      }
      
      console.log('保存模型...');
      const modelJson = this.model.toJSON();
      
      // 保存到localStorage
      localStorage.setItem('counterstrikle_neural_model', JSON.stringify(modelJson));
      localStorage.setItem('counterstrikle_encoders', JSON.stringify(this.attributeEncoders));
      localStorage.setItem('counterstrikle_feature_size', this.featureSize.toString());
      
      console.log('模型保存成功');
      return true;
    } catch (error) {
      console.error('模型保存失败:', error);
      return false;
    }
  }
  
  /**
   * 从本地存储加载模型
   */
  static async loadModel() {
    try {
      console.log('尝试加载保存的模型...');
      
      // 检查是否已加载TensorFlow.js
      const tf = getTensorFlow();
      if (!tf) {
        console.log('TensorFlow.js未加载，无法加载模型');
        return false;
      }
      
      const modelJson = localStorage.getItem('counterstrikle_neural_model');
      const encodersJson = localStorage.getItem('counterstrikle_encoders');
      const featureSizeStr = localStorage.getItem('counterstrikle_feature_size');
      
      if (!modelJson || !encodersJson || !featureSizeStr) {
        console.log('没有找到保存的模型');
        return false;
      }
      
      // 恢复编码器和特征大小
      this.attributeEncoders = JSON.parse(encodersJson);
      this.featureSize = parseInt(featureSizeStr, 10);
      
      // 恢复模型
      this.model = await tf.models.modelFromJSON(JSON.parse(modelJson));
      this.isModelTrained = true;
      
      console.log('模型加载成功');
      return true;
    } catch (error) {
      console.error('模型加载失败:', error);
      return false;
    }
  }
  
  /**
   * 初始化算法状态
   */
  static init() {
    this.lastGuessId = null;
    this.consecutiveGuessCounts = 0;
    
    console.log('神经网络算法模块已初始化');
    
    // 注册全局检查TensorFlow方法，以便在content.js中可以检查
    if (typeof window !== 'undefined') {
      // 确保可以正确获取TensorFlow状态
      window.checkNeuralNetworkTensorFlow = () => {
        const status = {
          available: isTensorFlowAvailable(),
          modelTrained: this.isModelTrained
        };
        console.log('神经网络状态检查结果:', status);
        return status;
      };
      
      // 暴露静态方法到全局，确保可以从页面访问
      window.NeuralAlgorithmModule = this;
      
      // 如果TensorFlow已经可用，尝试加载保存的模型
      if (isTensorFlowAvailable()) {
        console.log('TensorFlow已可用，尝试加载模型');
        setTimeout(() => this.loadModel().catch(err => console.warn('初始化时加载模型失败:', err)), 100);
      } else {
        console.log('TensorFlow尚未加载，模型将在需要时加载');
      }
    }
    
    // 不在这里加载模型，而是等待content.js中的loadTensorFlowIntoPage完成后再加载
    // 模型将在需要时加载（比如训练或预测时）
    
    return this;
  }
}

// 初始化模块
NeuralAlgorithm.init();

// 作为ES模块导出
export default NeuralAlgorithm; 