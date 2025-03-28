/**
 * 直接神经网络初始化脚本
 * 用于直接在页面中初始化神经网络
 */

(function() {
  try {
    console.log('直接初始化神经网络...');
    
    // 检查神经网络模块是否存在
    if (typeof window.NeuralAlgorithmModule === 'undefined') {
      // 尝试从GameState中获取神经网络模块
      console.warn('神经网络模块未定义，尝试从GameState中获取');
      
      // 检查是否有GameState对象
      if (typeof window.GameState !== 'undefined' && window.GameState.neuralAlgorithm) {
        console.log('从GameState中找到了神经网络模块，尝试将其设置为全局变量');
        window.NeuralAlgorithmModule = window.GameState.neuralAlgorithm;
      } else {
        // 如果仍然找不到，则报告失败
        window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
          detail: { success: false, error: '模块未定义，且无法从GameState中恢复' }
        }));
        return;
      }
    }
    
    if (typeof window.tf === 'undefined') {
      console.error('TensorFlow未定义，无法初始化');
      window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
        detail: { success: false, error: 'TensorFlow未定义' }
      }));
      return;
    }
    
    // 重新初始化
    console.log('重新初始化神经网络模块...');
    window.NeuralAlgorithmModule.init();
    
    // 尝试连接TensorFlow
    if (typeof window.NeuralAlgorithmModule.initNeuralNetwork === 'function') {
      console.log('直接初始化神经网络方法...');
      try {
        window.NeuralAlgorithmModule.initNeuralNetwork(true);
        console.log('神经网络直接初始化成功');
        
        // 验证TensorFlow功能
        try {
          const tensor = window.tf.tensor([1, 2, 3]);
          console.log('TensorFlow基本测试成功');
          tensor.dispose();
          
          window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
            detail: { success: true }
          }));
        } catch (tfError) {
          console.error('TensorFlow操作失败:', tfError);
          window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
            detail: { success: false, error: 'TensorFlow操作失败: ' + tfError.message }
          }));
        }
      } catch (initError) {
        console.error('直接初始化神经网络方法失败:', initError);
        window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
          detail: { success: false, error: initError.message }
        }));
      }
    } else {
      console.error('神经网络模块缺少初始化方法');
      window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
        detail: { success: false, error: '缺少初始化方法' }
      }));
    }
  } catch (error) {
    console.error('直接初始化神经网络出错:', error);
    window.dispatchEvent(new CustomEvent('direct_neural_init_complete', {
      detail: { success: false, error: error.message }
    }));
  }
})(); 