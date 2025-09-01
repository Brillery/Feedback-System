package ws

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
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
// 该函数负责验证用户身份信息，升级HTTP连接为WebSocket连接，
// 并启动客户端的读写协程
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

// SendMessageToUser 发送消息给特定用户（通过数字ID）
func (h *WSHandler) SendMessageToUser(userID uint64, userType uint8, message []byte) bool {
	return h.hub.SendToUser(userID, userType, message)
}

// SendMessageToUserByStr 发送消息给特定用户（通过字符串ID）
func (h *WSHandler) SendMessageToUserByStr(userIDStr string, userType uint8, message []byte) bool {
	return h.hub.SendToUserByStr(userIDStr, userType, message)
}

// BroadcastMessage 广播消息给所有用户
func (h *WSHandler) BroadcastMessage(message []byte) {
	h.hub.broadcast <- message
}

// GetHub 获取Hub
func (h *WSHandler) GetHub() *Hub {
	return h.hub
}
