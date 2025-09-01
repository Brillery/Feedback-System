package ws

import (
	"bytes"
	"encoding/json"
	"feedback-system/internal/consts"
	"feedback-system/internal/models"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// 写入超时时间
	writeWait = 10 * time.Second

	// 读取超时时间
	pongWait = 60 * time.Second

	// 发送ping的时间间隔，必须小于pongWait
	pingPeriod = (pongWait * 9) / 10

	// 最大消息大小
	maxMessageSize = 512 * 1024 // 512KB
)

var (
	newline = []byte("\n")
	space   = []byte(" ")
)

// ReadPump 是 WebSocket 客户端的消息读取循环函数，负责持续从连接中读取消息并根据消息类型进行处理。
// 当连接断开或发生错误时，会将当前客户端从 Hub 中注销。
//
// 参数:
//   - hub: WebSocket 消息中枢，用于管理所有客户端连接和消息广播
func (c *WSClient) ReadPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
	}()

	// 设置连接参数
	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// 持续读取消息
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// 处理消息
		// 外层TrimSpace切除空格，内层bytes.Replace将换行符替换为空格
		message = bytes.TrimSpace(bytes.Replace(message, newline, space, -1))

		// 解析消息
		var wsMessage models.WSMessage
		if err := json.Unmarshal(message, &wsMessage); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		// 添加发送者信息
		if wsMessage.Sender == nil {
			wsMessage.Sender = &models.Sender{
				ID:   c.UserID,
				Type: c.UserType,
				Name: c.UserName,
			}
		}

		// 添加时间戳
		if wsMessage.Timestamp.IsZero() {
			wsMessage.Timestamp = time.Now()
		}

		// 重新序列化消息
		updatedMessage, err := json.Marshal(wsMessage)
		if err != nil {
			log.Printf("Error marshaling updated message: %v", err)
			continue
		}

		// 根据消息类型处理
		switch wsMessage.Event {
		case consts.EventMessage:
			// 处理消息事件
			handleMessageEvent(hub, &wsMessage, updatedMessage)

		case consts.EventTyping:
			// 处理正在输入事件
			handleTypingEvent(hub, &wsMessage, updatedMessage)

		case consts.EventRead:
			// 处理已读事件
			handleReadEvent(hub, &wsMessage, updatedMessage)

		case consts.EventStatusChange:
			// 处理状态变更事件
			handleStatusChangeEvent(hub, &wsMessage, updatedMessage)

		case consts.EventFeedbackDelete:
			// 处理反馈删除事件
			log.Printf("WebSocket处理反馈删除事件: %s", string(updatedMessage))
			handleFeedbackDeleteEvent(hub, &wsMessage, updatedMessage)

		case "new_feedback":
			// 处理新反馈事件
			handleNewFeedbackEvent(hub, &wsMessage, updatedMessage)

		default:
			// 未知事件类型
			log.Printf("Unknown event type: %s", wsMessage.Event)
		}
	}
}

// 处理WebSocket连接的写操作
func (c *WSClient) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			// 设置写入超时
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))

			if !ok {
				// 通道已关闭
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// 获取写入器
			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}

			// 写入消息
			w.Write(message)

			// 添加队列中的消息
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write(newline)
				w.Write(<-c.Send)
			}

			// 关闭写入器
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			// 发送ping消息
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// 处理消息事件
func handleMessageEvent(hub *Hub, wsMessage *models.WSMessage, message []byte) {
	// 如果有接收者，发送给特定接收者
	if wsMessage.Receiver != nil {
		// 确保正确处理uint64类型的ID
		hub.SendToUser(wsMessage.Receiver.ID, wsMessage.Receiver.Type, message)
	} else {
		// 否则广播消息
		hub.broadcast <- message
	}
}

// 处理正在输入事件
func handleTypingEvent(hub *Hub, wsMessage *models.WSMessage, message []byte) {
	// 如果有接收者，发送给特定接收者
	if wsMessage.Receiver != nil {
		// 确保正确处理uint64类型的ID
		hub.SendToUser(wsMessage.Receiver.ID, wsMessage.Receiver.Type, message)
	}
}

// 处理已读事件
func handleReadEvent(hub *Hub, wsMessage *models.WSMessage, message []byte) {
	// 如果有接收者，发送给特定接收者
	if wsMessage.Receiver != nil {
		// 确保正确处理uint64类型的ID
		hub.SendToUser(wsMessage.Receiver.ID, wsMessage.Receiver.Type, message)
	}
}

// 处理状态变更事件
func handleStatusChangeEvent(hub *Hub, wsMessage *models.WSMessage, message []byte) {
	// 广播状态变更消息
	hub.broadcast <- message
}

// 处理反馈删除事件
func handleFeedbackDeleteEvent(hub *Hub, wsMessage *models.WSMessage, message []byte) {
	log.Printf("广播反馈删除消息: %s", string(message))
	// 广播反馈删除消息
	hub.broadcast <- message
}

// 处理新反馈事件
func handleNewFeedbackEvent(hub *Hub, wsMessage *models.WSMessage, message []byte) {
	// 如果有接收者，发送给特定接收者
	if wsMessage.Receiver != nil {
		hub.SendToUser(wsMessage.Receiver.ID, wsMessage.Receiver.Type, message)
	} else {
		// 否则广播消息
		hub.broadcast <- message
	}
}
