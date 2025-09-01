> 项目根目录，运行
```bash
go run cmd/main.go
```
- 实时+多标签页多开同类用户

---

# WebSocket架构详细梳理与分析

## 1. WebSocket架构概述

WebSocket是一种在单个TCP连接上进行全双工通信的协议，允许服务器主动向客户端推送数据。在您的反馈系统中，WebSocket主要用于实时通信，如消息推送、状态变更通知等。

## 2. 项目WebSocket架构组件

### 2.1 后端架构

#### 核心组件
- `pkg/ws/handler.go` - WebSocket处理程序
- `pkg/ws/handler.go` - 连接管理中心
- `pkg/ws/client.go` - 客户端连接管理
- `pkg/ws/ws_client.go` - WebSocket客户端结构

#### 工作流程
1. 客户端通过HTTP请求建立WebSocket连接
2. 服务器升级HTTP连接为WebSocket连接
3. 创建客户端实例并注册到Hub
4. 启动读写协程处理消息
5. 通过Hub进行消息广播或定向发送

### 2.2 前端架构

#### 核心组件
- `static/js/config.js` - WebSocket配置
- `static/js/user.js` - 用户端WebSocket处理
- `static/js/merchant.js` - 商家端WebSocket处理
- `static/js/admin.js` - 管理员端WebSocket处理

## 3. 详细实现分析

### 3.1 连接建立过程

#### 后端实现 (`pkg/ws/handler.go`)
```javascript
// 1. 客户端连接请求处理
func (h *WSHandler) HandleConnection(c *gin.Context) {
    // 获取用户信息参数
    userIDStr := c.Query("user_id")
    userTypeStr := c.Query("user_type")
    userName := c.Query("user_name")
    
    // 升级HTTP连接为WebSocket连接
    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    
    // 创建客户端实例
    client := NewWSClient(conn, userID, uint8(userType), userName)
    
    // 注册到Hub
    h.hub.register <- client
    
    // 启动读写协程
    go client.WritePump()
    go client.ReadPump(h.hub)
}
```


#### 前端实现 (`static/js/user.js`)
```javascript
connectWebSocket() {
    // 构建WebSocket URL
    const wsUrl = `${CONFIG.WS_URL}?user_id=${this.state.currentUser.id}&user_type=${CONFIG.USER_TYPE_NUMBERS.USER}&user_name=${this.state.currentUser.username}&token=${token}`;
    
    // 创建WebSocket连接
    this.state.wsConnection = new WebSocket(wsUrl);
    
    // 设置事件处理
    this.state.wsConnection.onopen = () => {
        console.log('WebSocket连接已建立');
    };
    
    this.state.wsConnection.onmessage = (event) => {
        this.handleWebSocketMessage(event.data);
    };
}
```


### 3.2 消息处理机制

#### 后端消息处理 (`pkg/ws/client.go`)
```javascript
func (c *WSClient) ReadPump(hub *Hub) {
    for {
        // 读取消息
        _, message, err := c.Conn.ReadMessage()
        
        // 解析消息
        var wsMessage models.WSMessage
        if err := json.Unmarshal(message, &wsMessage); err != nil {
            continue
        }
        
        // 根据消息类型处理
        switch wsMessage.Event {
        case consts.EventMessage:
            handleMessageEvent(hub, &wsMessage, updatedMessage)
        case consts.EventTyping:
            handleTypingEvent(hub, &wsMessage, updatedMessage)
        // ... 其他事件类型
        }
    }
}
```


#### 前端消息处理 (`static/js/user.js`)
```javascript
handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        
        switch (message.event) {
            case CONFIG.WS_EVENT_TYPE.MESSAGE:
                this.handleIncomingMessage(message);
                break;
            case CONFIG.WS_EVENT_TYPE.TYPING:
                this.handleTypingEvent(message);
                break;
            // ... 其他事件类型
        }
    } catch (error) {
        console.error('解析WebSocket消息失败:', error);
    }
}
```


### 3.3 消息广播与定向发送

#### Hub中心 (`pkg/ws/hub.go`)
```javascript
// 广播消息
func (h *Hub) broadcastMessage(message []byte) {
    h.mutex.Lock()
    defer h.mutex.Unlock()
    
    for client := range h.clients {
        select {
        case client.Send <- message:
        default:
            // 发送失败处理
        }
    }
}

// 定向发送消息
func (h *Hub) SendToUser(userID uint64, userType uint8, message []byte) bool {
    h.mutex.Lock()
    defer h.mutex.Unlock()
    
    userKey := getUserKeyByID(userID, userType)
    if client, exists := h.userClients[userKey]; exists {
        select {
        case client.Send <- message:
            return true
        default:
            // 发送失败处理
        }
    }
    return false
}
```


## 4. 消息类型与处理

### 4.1 支持的消息事件类型

| 事件类型 | 描述 | 使用场景 |
|---------|------|---------|
| `connect` | 连接事件 | 用户建立WebSocket连接时 |
| `disconnect` | 断开连接事件 | 用户断开WebSocket连接时 |
| `message` | 消息事件 | 用户发送消息时 |
| `typing` | 正在输入事件 | 用户正在输入消息时 |
| `read` | 已读事件 | 消息被标记为已读时 |
| `status_change` | 状态变更事件 | 反馈状态发生变化时 |
| `feedback_delete` | 反馈删除事件 | 反馈被删除时 |
| `new_feedback` | 新反馈事件 | 创建新反馈时 |

### 4.2 消息结构

```javascript
{
    "event": "message",           // 事件类型
    "timestamp": "2023-...",      // 时间戳
    "sender": {                   // 发送者信息
        "id": 1,
        "type": 1,
        "name": "用户名"
    },
    "receiver": {                 // 接收者信息（可选）
        "id": 2,
        "type": 2,
        "name": "接收者名"
    },
    "data": {                     // 消息数据
        // 根据事件类型不同而不同
    }
}
```


## 5. 实际应用场景

### 5.1 实时消息推送
当用户发送消息时，后端会通过WebSocket将消息实时推送给相关用户：

1. 用户A发送消息到后端API
2. 后端保存消息到数据库
3. 后端通过WebSocket将消息推送给用户B
4. 用户B实时收到消息通知

### 5.2 状态变更通知
当反馈状态发生变化时，系统会通知所有相关用户：

1. 管理员更新反馈状态
2. 后端更新数据库状态
3. 后端通过WebSocket广播状态变更消息
4. 所有相关用户实时收到状态更新

## 6. 架构优势与注意事项

### 6.1 优势
- **实时性**: 消息推送实时，用户体验好
- **双向通信**: 支持服务器主动推送消息
- **低延迟**: 相比轮询，减少了网络开销
- **可扩展**: 通过Hub管理连接，易于扩展

### 6.2 注意事项
- **连接管理**: 需要妥善处理连接的建立、维持和断开
- **消息可靠性**: 需要考虑消息丢失和重复的问题
- **安全性**: 需要验证连接和消息的合法性
- **性能优化**: 需要合理处理大量并发连接

## 7. 总结

WebSocket架构在您的反馈系统中扮演着实时通信的核心角色。通过建立持久连接，系统能够实现消息的实时推送、状态变更通知等功能，大大提升了用户体验。理解这一架构有助于更好地维护和扩展系统功能。// HandleConnection 处理WebSocket连接请求
// 该函数负责验证用户身份信息，升级HTTP连接为WebSocket连接，并启动客户端的读写协程
// 参数:
//   - c: gin框架的上下文对象，包含HTTP请求和响应信息
func (h *WSHandler) HandleConnection(c *gin.Context) {
	// 获取并验证用户基本信息
	userIDStr := c.Query("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing user ID"})
		return
	}

	// 将字符串ID转换为uint64
	userID, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	userTypeStr := c.Query("user_type")
	userType, err := strconv.ParseUint(userTypeStr, 10, 8)
	if err != nil || userType < 1 || userType > 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user type"})
		return
	}

	userName := c.Query("user_name")
	if userName == "" {
		userName = "User-" + strconv.FormatUint(userID, 10)
	}

	// 升级HTTP连接为WebSocket连接
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// 创建客户端
	client := NewWSClient(conn, userID, uint8(userType), userName)

	// 注册客户端到Hub中进行统一管理
	h.hub.register <- client

	// 启动读写协程
	go client.WritePump()
	go client.ReadPump(h.hub)
}
