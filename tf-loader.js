/**
 * TensorFlow加载脚本
 * 用于在页面中加载TensorFlow.js
 */

(function() {
  try {
    // 检查TensorFlow是否已加载
    if (typeof window.tf !== 'undefined') {
      console.log('TensorFlow.js已经加载，版本:', window.tf.version);
      window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
        detail: { 
          success: true, 
          version: window.tf.version 
        }
      }));
      return;
    }
    
    console.log('开始加载TensorFlow.js...');
    
    // 获取URL
    let tensorflowUrl = '/tensorflow.min.js';
    
    // 优先使用传入的URL
    if (window.tensorflowJsUrl) {
      tensorflowUrl = window.tensorflowJsUrl;
      console.log('使用传入的TensorFlow.js URL:', tensorflowUrl);
    }
    
    // 确保URL有效
    if (!tensorflowUrl || tensorflowUrl === '/tensorflow.min.js') {
      console.error('无效的TensorFlow.js URL');
      window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
        detail: { 
          success: false, 
          error: '无效的TensorFlow.js URL' 
        }
      }));
      return;
    }
    
    // 加载脚本到全局作用域
    const loadScript = function(url) {
      return new Promise((resolve, reject) => {
        console.log('加载脚本:', url);
        
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.async = false;  // 确保按顺序执行
        
        // 添加加载事件
        script.onload = function() {
          console.log('脚本加载完成');
          resolve();
        };
        
        script.onerror = function(e) {
          console.error('脚本加载失败:', e);
          reject(new Error('脚本加载失败'));
        };
        
        document.head.appendChild(script);
      });
    };
    
    // 加载TensorFlow.js
    loadScript(tensorflowUrl)
      .then(() => {
        // 检查tf对象是否定义
        console.log('检查TensorFlow.js是否成功加载...');
        
        // 给tf对象加载一点时间
        setTimeout(() => {
          if (typeof window.tf !== 'undefined') {
            console.log('TensorFlow.js加载成功，版本:', window.tf.version);
            
            // 创建验证脚本检查tf对象的所有关键功能
            const validateScript = document.createElement('script');
            validateScript.textContent = `
              console.log('验证TensorFlow.js功能...');
              try {
                // 创建一个简单的张量以验证核心功能
                const tensor = tf.tensor([1, 2, 3]);
                console.log('验证成功: 可以创建张量', tensor);
                tensor.dispose();
                
                window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
                  detail: { 
                    success: true, 
                    version: tf.version 
                  }
                }));
              } catch (error) {
                console.error('TensorFlow.js功能验证失败:', error);
                window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
                  detail: { 
                    success: false, 
                    error: '功能验证失败: ' + error.message 
                  }
                }));
              }
            `;
            document.head.appendChild(validateScript);
            setTimeout(() => validateScript.remove(), 100);
          } else {
            console.error('TensorFlow.js加载异常，未定义tf对象');
            
            // 尝试再次检查全局对象
            const debugScript = document.createElement('script');
            debugScript.textContent = `
              console.log('调试TensorFlow.js加载状态:');
              console.log('全局对象中的tf:', typeof window.tf);
              console.log('全局对象属性:', Object.keys(window).filter(k => k.includes('tf') || k.includes('tensor')));
              
              window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
                detail: { 
                  success: false, 
                  error: 'TensorFlow.js加载后未定义tf对象 (已输出调试信息)'
                }
              }));
            `;
            document.head.appendChild(debugScript);
            setTimeout(() => debugScript.remove(), 100);
          }
        }, 500);  // 给一点时间让脚本完全初始化
      })
      .catch(error => {
        console.error('加载TensorFlow.js失败:', error);
        window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
          detail: { 
            success: false, 
            error: '加载TensorFlow.js文件失败: ' + error.message 
          }
        }));
      });
  } catch (error) {
    console.error('加载TensorFlow.js时出错:', error);
    window.dispatchEvent(new CustomEvent('tensorflowLoaded', {
      detail: { 
        success: false, 
        error: error.message 
      }
    }));
  }
})(); 