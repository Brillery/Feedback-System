package ws

import (
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"strconv"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// 允许所有跨域请求
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// WSHandler WebSocket处理程序
type WSHandler struct {
	hub *Hub
}

// NewWSHandler 创建新的WebSocket处理程序
func NewWSHandler() *WSHandler {
	hub := NewHub()
	go hub.Run()

	return &WSHandler{
		hub: hub,
	}
}

// HandleConnection 处理WebSocket连接请求
func (h *WSHandler) HandleConnection(c *gin.Context) {
	// 获取用户信息
	userID, err := strconv.ParseUint(c.Query("user_id"), 10, 64)
	if err != nil || userID == 0 {
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

	// 注册客户端
	h.hub.register <- client

	// 启动读写协程
	go client.WritePump()
	go client.ReadPump(h.hub)
}

// SendMessageToUser 发送消息给特定用户
func (h *WSHandler) SendMessageToUser(userID uint64, userType uint8, message []byte) bool {
	return h.hub.SendToUser(userID, userType, message)
}

// BroadcastMessage 广播消息给所有用户
func (h *WSHandler) BroadcastMessage(message []byte) {
	h.hub.broadcast <- message
}

// GetHub 获取Hub
func (h *WSHandler) GetHub() *Hub {
	return h.hub
}
