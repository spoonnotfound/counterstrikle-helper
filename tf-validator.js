/**
 * TensorFlow验证脚本
 * 验证TensorFlow.js是否正确加载并能创建张量
 */

(function() {
  try {
    console.log('TensorFlow.js验证脚本开始执行');
    
    // 检查TensorFlow是否已加载
    if (typeof window.tf === 'undefined') {
      console.error('TensorFlow对象未定义');
      window.dispatchEvent(new CustomEvent('tf_validation_complete', { 
        detail: { 
          success: false, 
          error: 'TensorFlow对象未定义' 
        } 
      }));
      return;
    }
    
    console.log('TensorFlow对象已定义，版本:', window.tf.version);
    
    // 尝试创建一个简单的张量
    try {
      const tensor = window.tf.tensor([1, 2, 3]);
      console.log('成功创建张量:', tensor);
      
      // 测试一些基本操作
      const result = tensor.add(tf.scalar(1));
      console.log('基本操作测试成功，结果:', result);
      
      // 释放内存
      tensor.dispose();
      result.dispose();
      
      // 验证成功
      window.dispatchEvent(new CustomEvent('tf_validation_complete', { 
        detail: { 
          success: true, 
          version: window.tf.version 
        } 
      }));
    } catch (opError) {
      console.error('TensorFlow基本操作失败:', opError);
      window.dispatchEvent(new CustomEvent('tf_validation_complete', { 
        detail: { 
          success: false, 
          error: '操作验证失败: ' + opError.message 
        } 
      }));
    }
  } catch (error) {
    console.error('TensorFlow.js验证失败:', error);
    window.dispatchEvent(new CustomEvent('tf_validation_complete', { 
      detail: { 
        success: false, 
        error: error.message 
      } 
    }));
  }
})(); 