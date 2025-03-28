/**
 * TensorFlow和神经网络状态检查脚本
 * 提供全局函数用于检查TensorFlow和神经网络的状态
 */

// 全局函数，用于检查TensorFlow.js和神经网络的状态
window.checkNeuralNetworkTensorFlow = function() {
  console.log('执行TensorFlow神经网络状态检查...');
  
  // 检查TensorFlow是否可用
  const tensorFlowAvailable = typeof window.tf !== 'undefined';
  
  // 检查神经算法模块是否可用
  const moduleAvailable = typeof window.NeuralAlgorithmModule !== 'undefined';
  
  let modelTrained = false;
  let modelLoaded = false;
  
  // 如果模块可用，检查模型是否已训练
  if (moduleAvailable) {
    try {
      // 检查模型是否已训练（通过isModelTrained属性）
      modelTrained = window.NeuralAlgorithmModule.isModelTrained || false;
      
      // 检查模型是否已加载（通过model属性）
      modelLoaded = window.NeuralAlgorithmModule.model !== null && 
                    typeof window.NeuralAlgorithmModule.model !== 'undefined';
      
      console.log('神经网络模型状态:', {
        trained: modelTrained,
        loaded: modelLoaded
      });
    } catch (error) {
      console.error('检查神经网络模型状态时出错:', error);
    }
  }
  
  // 进行TensorFlow功能验证
  let tfFunctional = false;
  if (tensorFlowAvailable) {
    try {
      // 创建一个简单的tensor测试TensorFlow功能
      const testTensor = window.tf.tensor([1, 2, 3]);
      testTensor.dispose();
      tfFunctional = true;
      console.log('TensorFlow功能测试成功');
    } catch (tfError) {
      console.error('TensorFlow功能测试失败:', tfError);
    }
  }
  
  // 返回完整状态对象
  return {
    tensorFlowAvailable: tensorFlowAvailable,
    tensorFlowFunctional: tfFunctional,
    moduleAvailable: moduleAvailable,
    modelTrained: modelTrained,
    modelLoaded: modelLoaded,
    available: tensorFlowAvailable && moduleAvailable && tfFunctional
  };
};

// 立即执行并打印状态，便于调试
(function() {
  try {
    const status = window.checkNeuralNetworkTensorFlow();
    console.log('TensorFlow和神经网络状态检查结果:', status);
  } catch (error) {
    console.error('执行状态检查时出错:', error);
  }
})(); 