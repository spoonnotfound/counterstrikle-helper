/**
 * 神经网络初始化脚本
 * 用于初始化神经网络模型
 */

(function() {
  try {
    console.log('神经网络初始化脚本开始执行');
    
    // 检查依赖
    if (typeof window.tf === 'undefined') {
      throw new Error('TensorFlow.js未加载，无法初始化神经网络');
    }
    
    if (typeof window.NeuralAlgorithmModule === 'undefined') {
      throw new Error('神经网络模块未加载，无法初始化');
    }
    
    console.log('所有依赖已加载，开始初始化神经网络...');
    
    // 重新初始化模块
    console.log('重新初始化神经网络模块...');
    window.NeuralAlgorithmModule.init();
    
    // 强制初始化神经网络
    if (typeof window.NeuralAlgorithmModule.initNeuralNetwork === 'function') {
      console.log('初始化神经网络...');
      try {
        window.NeuralAlgorithmModule.initNeuralNetwork(true);
        console.log('神经网络初始化成功');
        
        // 验证是否成功
        try {
          console.log('验证神经网络功能...');
          
          // 尝试创建一个简单模型
          const model = window.tf.sequential();
          model.add(window.tf.layers.dense({
            units: 1,
            inputShape: [1]
          }));
          
          console.log('成功创建测试模型');
          
          // 通知成功
          window.dispatchEvent(new CustomEvent('neural_manual_init_complete', {
            detail: { 
              success: true,
              message: '神经网络成功初始化'
            }
          }));
        } catch (validationError) {
          console.error('神经网络功能验证失败:', validationError);
          window.dispatchEvent(new CustomEvent('neural_manual_init_complete', {
            detail: { 
              success: false, 
              error: '功能验证失败: ' + validationError.message 
            }
          }));
        }
      } catch (initError) {
        console.error('初始化神经网络失败:', initError);
        window.dispatchEvent(new CustomEvent('neural_manual_init_complete', {
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
    console.error('神经网络初始化脚本失败:', error);
    window.dispatchEvent(new CustomEvent('neural_manual_init_complete', {
      detail: { 
        success: false, 
        error: error.message 
      }
    }));
  }
})(); 