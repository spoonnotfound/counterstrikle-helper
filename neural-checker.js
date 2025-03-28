/**
 * 神经网络状态检查脚本
 * 用于检查页面中神经网络模型状态
 */

(function() {
  try {
    // 更详细的调试信息
    console.log('神经网络检查脚本开始执行');
    console.log('TensorFlow状态:', typeof window.tf !== 'undefined' ? `已加载 (${window.tf.version})` : '未加载');
    console.log('NeuralNetwork状态:', typeof window.NeuralAlgorithmModule !== 'undefined' ? '已加载' : '未加载');
    
    // 从当前脚本的data属性中获取tf-status-checker.js的URL
    const currentScript = document.currentScript;
    const tfStatusCheckerUrl = currentScript ? currentScript.dataset.tfStatusCheckerUrl : null;
    
    // 检查是否已加载检查函数，如果没有则先加载
    if (typeof window.checkNeuralNetworkTensorFlow !== 'function') {
      console.log('加载TensorFlow状态检查器...');
      
      const completeCheck = function() {
        try {
          // 确保TensorFlow.js可用
          let tfAvailable = false;
          try {
            // 尝试使用TensorFlow创建一个简单的tensor来验证它是否真正可用
            if (typeof window.tf !== 'undefined') {
              const testTensor = window.tf.tensor([1, 2, 3]);
              testTensor.dispose();
              tfAvailable = true;
              console.log('TensorFlow功能测试成功');
            }
          } catch (tfError) {
            console.error('TensorFlow功能测试失败:', tfError);
            tfAvailable = false;
          }
          
          // 确保神经网络检查函数可用
          let checkFnAvailable = false;
          let modelTrained = false;
          
          if (typeof window.checkNeuralNetworkTensorFlow === 'function') {
            try {
              const status = window.checkNeuralNetworkTensorFlow();
              checkFnAvailable = true;
              modelTrained = status.modelTrained;
              console.log('神经网络检查函数测试成功:', status);
            } catch (checkError) {
              console.error('神经网络检查函数测试失败:', checkError);
            }
          } else if (typeof window.NeuralAlgorithmModule !== 'undefined') {
            // 如果检查函数不可用，但神经网络模块可用，尝试直接访问
            try {
              checkFnAvailable = true;
              modelTrained = window.NeuralAlgorithmModule.isModelTrained || false;
              console.log('通过模块直接访问神经网络状态:', { modelTrained });
            } catch (moduleError) {
              console.error('通过模块访问神经网络状态失败:', moduleError);
            }
          }
          
          // 构建状态对象
          const neuralStatus = {
            available: tfAvailable && (checkFnAvailable || typeof window.NeuralAlgorithmModule !== 'undefined'),
            modelTrained: modelTrained,
            tensorFlowAvailable: tfAvailable,
            checkFunctionAvailable: checkFnAvailable,
            moduleAvailable: typeof window.NeuralAlgorithmModule !== 'undefined'
          };
          
          // 发送结果事件
          window.dispatchEvent(new CustomEvent('neural_network_status', {
            detail: neuralStatus
          }));
          
          console.log('神经网络状态检查完成:', neuralStatus);
        } catch (error) {
          console.error('检查神经网络状态时出错:', error);
          window.dispatchEvent(new CustomEvent('neural_network_status', {
            detail: {
              available: false,
              modelTrained: false,
              tensorFlowAvailable: typeof window.tf !== 'undefined',
              error: error.message
            }
          }));
        }
      };
      
      if (tfStatusCheckerUrl) {
        // 加载状态检查脚本
        const statusCheckerScript = document.createElement('script');
        statusCheckerScript.src = tfStatusCheckerUrl;
        statusCheckerScript.onload = function() {
          console.log('TensorFlow状态检查器加载成功');
          this.remove();
          setTimeout(completeCheck, 100); // 给脚本一点时间初始化
        };
        statusCheckerScript.onerror = function(err) {
          console.error('加载TensorFlow状态检查器失败:', err);
          this.remove();
          completeCheck(); // 尽管加载失败，但仍尝试执行检查
        };
        document.head.appendChild(statusCheckerScript);
      } else {
        console.warn('未找到tf-status-checker.js的URL，将直接执行检查');
        completeCheck();
      }
    } else {
      console.log('检查函数已定义，直接进行检查');
      // 确保TensorFlow.js可用
      let tfAvailable = false;
      try {
        // 尝试使用TensorFlow创建一个简单的tensor来验证它是否真正可用
        if (typeof window.tf !== 'undefined') {
          const testTensor = window.tf.tensor([1, 2, 3]);
          testTensor.dispose();
          tfAvailable = true;
          console.log('TensorFlow功能测试成功');
        }
      } catch (tfError) {
        console.error('TensorFlow功能测试失败:', tfError);
        tfAvailable = false;
      }
      
      // 使用现有的检查函数
      let status;
      try {
        status = window.checkNeuralNetworkTensorFlow();
        console.log('使用现有检查函数的结果:', status);
      } catch (checkError) {
        console.error('使用现有检查函数失败:', checkError);
        status = {
          tensorFlowAvailable: tfAvailable,
          moduleAvailable: typeof window.NeuralAlgorithmModule !== 'undefined',
          modelTrained: false
        };
      }
      
      // 构建状态对象
      const neuralStatus = {
        available: tfAvailable && status.moduleAvailable,
        modelTrained: status.modelTrained || false,
        tensorFlowAvailable: tfAvailable,
        checkFunctionAvailable: true,
        moduleAvailable: status.moduleAvailable
      };
      
      // 发送结果事件
      window.dispatchEvent(new CustomEvent('neural_network_status', {
        detail: neuralStatus
      }));
      
      console.log('神经网络状态检查完成:', neuralStatus);
    }
  } catch (error) {
    console.error('检查神经网络状态时出错:', error);
    window.dispatchEvent(new CustomEvent('neural_network_status', {
      detail: {
        available: false,
        modelTrained: false,
        tensorFlowAvailable: typeof window.tf !== 'undefined',
        error: error.message
      }
    }));
  }
})();