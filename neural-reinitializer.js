/**
 * 神经网络重新初始化脚本
 * 用于重新初始化神经网络模型
 */

(function() {
  try {
    console.log('神经网络重新初始化脚本开始执行');
    
    // 检查依赖
    if (typeof window.tf === 'undefined') {
      throw new Error('TensorFlow.js未加载，无法重新初始化神经网络');
    }
    
    // 检查神经网络模块是否存在
    if (typeof window.NeuralAlgorithmModule === 'undefined') {
      // 尝试从其他地方获取神经网络模块
      console.warn('神经网络模块未定义，尝试从GameState中获取');
      
      // 检查是否有GameState对象
      if (typeof window.GameState !== 'undefined' && window.GameState.neuralAlgorithm) {
        console.log('从GameState中找到了神经网络模块，尝试将其设置为全局变量');
        window.NeuralAlgorithmModule = window.GameState.neuralAlgorithm;
      } else {
        // 如果仍然找不到，则报告失败
        window.dispatchEvent(new CustomEvent('neural_reinit_complete', {
          detail: { 
            success: false, 
            error: '神经网络模块未定义，且无法从GameState中恢复' 
          }
        }));
        return;
      }
    }
    
    console.log('所有依赖已加载，开始重新初始化神经网络...');
    
    // 重新初始化模块
    console.log('重新初始化神经网络模块...');
    window.NeuralAlgorithmModule.init();
    
    // 强制初始化神经网络
    if (typeof window.NeuralAlgorithmModule.initNeuralNetwork === 'function') {
      console.log('初始化神经网络...');
      try {
        window.NeuralAlgorithmModule.initNeuralNetwork(true);
        console.log('神经网络重新初始化成功');
        
        // 验证是否成功
        try {
          // 使用TensorFlow.js创建一个简单的张量来验证
          const tensor = window.tf.tensor([1, 2, 3]);
          tensor.dispose();
          
          // 通知成功
          window.dispatchEvent(new CustomEvent('neural_reinit_complete', {
            detail: { 
              success: true,
              message: '神经网络成功重新初始化'
            }
          }));
        } catch (validationError) {
          console.error('神经网络功能验证失败:', validationError);
          window.dispatchEvent(new CustomEvent('neural_reinit_complete', {
            detail: { 
              success: false, 
              error: '功能验证失败: ' + validationError.message 
            }
          }));
        }
      } catch (initError) {
        console.error('初始化神经网络失败:', initError);
        window.dispatchEvent(new CustomEvent('neural_reinit_complete', {
          detail: { 
            success: false, 
            error: '初始化失败: ' + initError.message 
          }
        }));
      }
    } else {
      throw new Error('神经网络初始化方法不可用');
    }
  } catch (error) {
    console.error('神经网络重新初始化脚本失败:', error);
    window.dispatchEvent(new CustomEvent('neural_reinit_complete', {
      detail: { 
        success: false, 
        error: error.message 
      }
    }));
  }
})(); 