/**
 * WebSocket 拦截器
 * 用于拦截和处理游戏的 WebSocket 通信
 */
(function() {
  // 防止重复注入
  if (window._wsInterceptorInjected) return;
  window._wsInterceptorInjected = true;
  
  console.log('WebSocket拦截器脚本开始执行');
  
  // 状态常量
  const WS_STATES = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
  
  // 事件名
  const EVENTS = {
    SEND: 'webSocketSend',
    MESSAGE: 'webSocketMessage',
    STATUS: 'webSocketStatus',
    GUESS_SENT: 'guessSent',
    SEND_GUESS: 'sendGuess'
  };
  
  // 存储当前活动的 WebSocket
  let activeSocket = null;
  
  /**
   * 初始化 WebSocket 拦截
   */
  function initialize() {
    // 保存原始的 WebSocket 方法
    const originalSend = WebSocket.prototype.send;
    const originalAddEventListener = WebSocket.prototype.addEventListener;
    
    // 覆盖 send 方法
    overrideSendMethod(originalSend);
    
    // 覆盖 addEventListener 方法
    overrideAddEventListener(originalAddEventListener);
    
    // 监听猜测请求
    setupGuessHandler();
    
    // 定期检查 WebSocket 状态
    setupStatusMonitor();
    
    console.log('WebSocket 拦截器初始化完成');
  }
  
  /**
   * 覆盖 WebSocket 发送方法
   * @param {Function} originalSend - 原始的 send 方法
   */
  function overrideSendMethod(originalSend) {
    WebSocket.prototype.send = function(data) {
      // 保存引用
      activeSocket = this;
      
      try {
        // 生成日志信息
        const logData = typeof data === 'string' 
          ? (data.length > 100 ? data.substring(0, 100) + '...' : data) 
          : '[binary data]';
        console.log('WebSocket 发送数据:', logData);
        
        // 通知 content 脚本
        dispatchEvent(EVENTS.SEND, {
          data: typeof data === 'string' ? data : '[binary data]',
          url: this.url || ''
        });
      } catch (error) {
        console.error('拦截 send 方法时出错:', error);
      }
      
      // 调用原始方法
      return originalSend.apply(this, arguments);
    };
  }
  
  /**
   * 覆盖 WebSocket addEventListener 方法以拦截消息
   * @param {Function} originalMethod - 原始的 addEventListener 方法
   */
  function overrideAddEventListener(originalMethod) {
    WebSocket.prototype.addEventListener = function(type, listener, options) {
      if (type === 'message') {
        const originalListener = listener;
        const newListener = function(event) {
          // 记录当前 WebSocket
          activeSocket = this;
          
          // 通知 content 脚本
          try {
            dispatchEvent(EVENTS.MESSAGE, {
              data: typeof event.data === 'string' ? event.data : '[binary data]'
            });
          } catch (error) {
            console.error('处理 WebSocket 消息事件出错:', error);
          }
          
          // 调用原始监听器
          return originalListener.apply(this, arguments);
        };
        
        return originalMethod.call(this, type, newListener, options);
      }
      
      return originalMethod.apply(this, arguments);
    };
  }
  
  /**
   * 设置猜测请求处理器
   */
  function setupGuessHandler() {
    window.addEventListener(EVENTS.SEND_GUESS, function(event) {
      try {
        if (isWebSocketReady()) {
          console.log('收到猜测请求，开始发送数据:', event.detail.message.substring(0, 100));
          activeSocket.send(event.detail.message);
          
          dispatchEvent(EVENTS.GUESS_SENT, { success: true });
        } else {
          const error = {
            success: false,
            error: 'WebSocket未连接或不可用',
            readyState: getSocketState()
          };
          
          console.error(`无法发送猜测: ${error.error} (${error.readyState})`);
          dispatchEvent(EVENTS.GUESS_SENT, error);
        }
      } catch (error) {
        console.error('发送猜测时出错:', error);
        
        dispatchEvent(EVENTS.GUESS_SENT, {
          success: false,
          error: error.message
        });
      }
    });
  }
  
  /**
   * 设置 WebSocket 状态监控
   */
  function setupStatusMonitor() {
    setInterval(() => {
      const isActive = isWebSocketReady();
      const readyState = getSocketState();
      
      if (activeSocket) {
        console.log('当前活跃 WebSocket 状态:', getReadyStateText(readyState));
      } else {
        console.log('没有活跃的 WebSocket 连接');
      }
      
      // 通知 content 脚本
      dispatchEvent(EVENTS.STATUS, { 
        active: isActive,
        readyState: readyState
      });
    }, 10000); // 每10秒检查一次
  }
  
  /**
   * 检查 WebSocket 是否就绪
   * @returns {boolean} WebSocket 是否就绪可用
   */
  function isWebSocketReady() {
    return activeSocket && activeSocket.readyState === WS_STATES.OPEN;
  }
  
  /**
   * 获取当前 WebSocket 状态
   * @returns {number|string} WebSocket 状态码或文本
   */
  function getSocketState() {
    return activeSocket ? activeSocket.readyState : 'no socket';
  }
  
  /**
   * 获取可读的 WebSocket 状态文本
   * @param {number} state - WebSocket 状态码
   * @returns {string} 状态文本
   */
  function getReadyStateText(state) {
    const stateMap = {
      [WS_STATES.CONNECTING]: 'CONNECTING',
      [WS_STATES.OPEN]: 'OPEN',
      [WS_STATES.CLOSING]: 'CLOSING',
      [WS_STATES.CLOSED]: 'CLOSED'
    };
    
    return stateMap[state] || '未知';
  }
  
  /**
   * 触发自定义事件
   * @param {string} eventName - 事件名称
   * @param {Object} detail - 事件详情
   */
  function dispatchEvent(eventName, detail) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
  
  // 开始初始化
  initialize();
})(); 