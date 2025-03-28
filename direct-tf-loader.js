/**
 * 直接TensorFlow加载器
 * 该脚本直接将TensorFlow.js加载到页面中
 */

(function() {
  console.log('直接TensorFlow加载器启动');
  
  // 从URL参数获取TensorFlow的路径
  const getScriptParams = function() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('direct-tf-loader.js')) {
        // 获取URL参数
        const url = new URL(src);
        return {
          tfUrl: url.searchParams.get('tfUrl')
        };
      }
    }
    return {};
  };
  
  // 加载TensorFlow.js
  const loadTensorFlow = function(url) {
    if (!url) {
      console.error('未提供TensorFlow.js URL');
      return Promise.reject(new Error('未提供TensorFlow.js URL'));
    }
    
    console.log('加载TensorFlow.js:', url);
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.type = 'text/javascript';
      script.async = false;
      
      script.onload = function() {
        console.log('TensorFlow.js脚本加载完成');
        
        // 验证TensorFlow.js是否正确加载
        setTimeout(() => {
          if (typeof window.tf !== 'undefined') {
            console.log('TensorFlow.js加载成功!', window.tf.version);
            window.dispatchEvent(new CustomEvent('tensorflowDirectLoaded', {
              detail: {
                success: true,
                version: window.tf.version
              }
            }));
            resolve();
          } else {
            const error = new Error('TensorFlow.js加载失败: tf对象未定义');
            console.error(error);
            window.dispatchEvent(new CustomEvent('tensorflowDirectLoaded', {
              detail: {
                success: false,
                error: error.message
              }
            }));
            reject(error);
          }
        }, 300);
      };
      
      script.onerror = function(err) {
        const error = new Error('加载TensorFlow.js脚本失败');
        console.error(error, err);
        window.dispatchEvent(new CustomEvent('tensorflowDirectLoaded', {
          detail: {
            success: false,
            error: error.message
          }
        }));
        reject(error);
      };
      
      document.head.appendChild(script);
    });
  };
  
  // 从当前脚本参数获取TensorFlow URL
  const params = getScriptParams();
  
  if (params.tfUrl) {
    loadTensorFlow(params.tfUrl)
      .then(() => {
        console.log('直接加载TensorFlow.js成功');
      })
      .catch(error => {
        console.error('直接加载TensorFlow.js失败:', error);
      });
  } else {
    console.error('未找到TensorFlow.js URL参数');
    window.dispatchEvent(new CustomEvent('tensorflowDirectLoaded', {
      detail: {
        success: false,
        error: '未找到TensorFlow.js URL参数'
      }
    }));
  }
})(); 