/**
 * TensorFlow检查脚本
 * 用于检查页面中是否存在TensorFlow.js
 */

(function() {
  try {
    // 检查TensorFlow是否已加载
    const tfStatus = {
      loaded: typeof window.tf !== 'undefined',
      version: typeof window.tf !== 'undefined' ? window.tf.version : null
    };
    
    // 发送结果事件
    window.dispatchEvent(new CustomEvent('tf_check_result', {
      detail: tfStatus
    }));
    
    console.log('TensorFlow.js状态检查完成:', tfStatus);
  } catch (error) {
    console.error('检查TensorFlow.js状态时出错:', error);
    window.dispatchEvent(new CustomEvent('tf_check_result', {
      detail: {
        loaded: false,
        error: error.message
      }
    }));
  }
})(); 