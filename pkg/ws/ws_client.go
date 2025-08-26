package ws

import (
	"github.com/gorilla/websocket"
	"sync"
)

// WSClient WebSocket客户端连接
type WSClient struct {
	Conn      *websocket.Conn // WebSocket连接
	UserID    uint64          // 用户ID
	UserType  uint8           // 用户类型：1-用户 2-商家 3-管理员
	UserName  string          // 用户名称
	Send      chan []byte     // 发送消息的通道
	mutex     sync.Mutex      // 互斥锁，保证并发安全
	IsClosing bool            // 是否正在关闭
}

// NewWSClient 创建新的WebSocket客户端
func NewWSClient(conn *websocket.Conn, userID uint64, userType uint8, userName string) *WSClient {
	return &WSClient{
		Conn:     conn,
		UserID:   userID,
		UserType: userType,
		UserName: userName,
		Send:     make(chan []byte, 256), // 缓冲区大小为256
	}
}

// Close 关闭WebSocket连接
func (c *WSClient) Close() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.IsClosing {
		return
	}

	c.IsClosing = true
	c.Conn.Close()
	close(c.Send)
}
