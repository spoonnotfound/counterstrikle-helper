(function() {
  // 检查是否已经注入过
  if (window._wsInterceptorInjected) return;
  window._wsInterceptorInjected = true;
  
  console.log('WebSocket拦截器脚本开始执行');
  
  // 保存原始的 send 方法
  const originalSend = WebSocket.prototype.send;
  
  // 全局变量存储最近使用的 WebSocket
  window.lastActiveSocket = null;
  
  // 重写 send 方法
  WebSocket.prototype.send = function(data) {
    // 存储这个 WebSocket 实例的引用
    window.lastActiveSocket = this;
    
    try {
      console.log('WebSocket 发送数据:', typeof data === 'string' ? 
        (data.length > 100 ? data.substring(0, 100) + '...' : data) : 
        '[binary data]'
      );
      
      // 通知content脚本
      window.dispatchEvent(new CustomEvent('webSocketSend', {
        detail: {
          data: typeof data === 'string' ? data : '[binary data]',
          url: this.url || ''
        }
      }));
    } catch (e) {
      console.error('拦截send方法时出错:', e);
    }
    
    // 调用原始方法
    return originalSend.apply(this, arguments);
  };
  
  // 监听onmessage事件
  const originalAddEventListener = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function(type, listener, options) {
    if (type === 'message') {
      const originalListener = listener;
      const newListener = function(event) {
        // 当收到消息时，记录当前WebSocket
        window.lastActiveSocket = this;
        // 通知content脚本
        try {
          window.dispatchEvent(new CustomEvent('webSocketMessage', {
            detail: {
              data: typeof event.data === 'string' ? event.data : '[binary data]'
            }
          }));
        } catch (e) {
          console.error('处理WebSocket消息事件出错:', e);
        }
        return originalListener.apply(this, arguments);
      };
      return originalAddEventListener.call(this, type, newListener, options);
    }
    return originalAddEventListener.apply(this, arguments);
  };
  
  // 监听来自content脚本的发送猜测请求
  window.addEventListener('sendGuess', function(event) {
    try {
      if (window.lastActiveSocket && window.lastActiveSocket.readyState === 1) {
        console.log('收到猜测请求，开始发送数据:', event.detail.message.substring(0, 100));
        window.lastActiveSocket.send(event.detail.message);
        window.dispatchEvent(new CustomEvent('guessSent', {
          detail: { success: true }
        }));
      } else {
        console.error('无法发送猜测，WebSocket未连接或不可用');
        window.dispatchEvent(new CustomEvent('guessSent', {
          detail: { 
            success: false, 
            error: 'WebSocket未连接或不可用',
            readyState: window.lastActiveSocket ? window.lastActiveSocket.readyState : 'no socket'
          }
        }));
      }
    } catch (e) {
      console.error('发送猜测时出错:', e);
      window.dispatchEvent(new CustomEvent('guessSent', {
        detail: { success: false, error: e.message }
      }));
    }
  });
  
  // 定期检查window.lastActiveSocket的状态，频率降低到10秒一次
  setInterval(() => {
    if (window.lastActiveSocket) {
      const stateMap = {
        0: 'CONNECTING',
        1: 'OPEN',
        2: 'CLOSING',
        3: 'CLOSED'
      };
      console.log('当前活跃WebSocket状态:', stateMap[window.lastActiveSocket.readyState] || '未知');
      
      // 通知content脚本
      window.dispatchEvent(new CustomEvent('webSocketStatus', {
        detail: { 
          active: window.lastActiveSocket.readyState === 1,
          readyState: window.lastActiveSocket.readyState
        }
      }));
    } else {
      console.log('没有活跃的WebSocket连接');
    }
  }, 10000); // 每10秒检查一次
  
  console.log('WebSocket.prototype.send 方法已成功拦截，等待猜测指令...');
})(); 