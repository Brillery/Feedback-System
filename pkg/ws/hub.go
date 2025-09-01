package ws

import (
	"encoding/json"
	"feedback-system/internal/consts"
	"feedback-system/internal/models"
	"fmt"
	"log"
	"sync"
	"time"
)

// Hub WebSocket连接管理中心
type Hub struct {
	// 所有活跃的客户端连接
	// 快速检查某个连接是否仍然活跃，广播消息给所有客户端
	clients map[*WSClient]bool

	// 按用户ID和类型索引的客户端连接
	userClients map[string]*WSClient

	// 注册新客户端的通道
	register chan *WSClient

	// 注销客户端的通道
	unregister chan *WSClient

	// 广播消息的通道
	broadcast chan []byte

	// 互斥锁，保证并发安全
	mutex sync.Mutex
}

// NewHub 创建新的Hub
func NewHub() *Hub {
	return &Hub{
		clients:     make(map[*WSClient]bool),
		userClients: make(map[string]*WSClient),
		register:    make(chan *WSClient),
		unregister:  make(chan *WSClient),
		broadcast:   make(chan []byte),
	}
}

// Run 启动Hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		}
	}
}

// 注册客户端
func (h *Hub) registerClient(client *WSClient) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// 添加到活跃客户端列表
	h.clients[client] = true

	// 按用户ID和类型索引
	userKey := getUserKeyByID(client.UserID, client.UserType)

	// 如果该用户已有连接，关闭旧连接
	if oldClient, exists := h.userClients[userKey]; exists {
		oldClient.Close()
		delete(h.clients, oldClient)
	}

	// 保存新连接
	h.userClients[userKey] = client

	// 发送连接成功事件
	h.sendConnectEvent(client)

	log.Printf("Client registered: UserID=%d, UserType=%d", client.UserID, client.UserType)
}

// 注销客户端
func (h *Hub) unregisterClient(client *WSClient) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// 从活跃客户端列表移除
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)

		// 从用户索引中移除
		userKey := getUserKeyByID(client.UserID, client.UserType)
		// 这里为什么要双重检查？ 前面不是已经有了写锁吗，为啥还要多判断c == client
		// exists 检查：确认在 userClients 映射中是否存在对应 userKey 的条目
		// c == client 检查：确认映射中存储的客户端正是我们要注销的客户端
		//
		// 问题的核心在于两个不同通道的并发操作
		// 我注销有一个通道，注册有一个通道，虽然能保证同时只有一个协程在注销某个客户端，
		// 但是不能保证处在注册通道的某个客户端先一步执行，修改了即将要被注销的客户端，
		// 正因为这个时间差，所以应该多判断一步，也就是：即将要删的客户端，是否已经变更

		/*
			T1: unregister通道收到旧客户端A的注销请求
			T2: register通道收到同一用户的新连接请求，创建客户端B
			T3: registerClient执行：
			    - 发现userClients[userKey]中是旧客户端A
			    - 关闭A，从clients和userClients中删除A
			    - 将userClients[userKey]更新为新客户端B
			T4: unregisterClient开始执行（处理旧客户端A）：
			    - A已经从clients中删除了（T3时）
			    - 但在userClients[userKey]中现在是客户端B！
			    - 如果不检查 c == client，就会误删客户端B的映射！
		*/

		if c, exists := h.userClients[userKey]; exists && c == client {
			delete(h.userClients, userKey)
		}

		// 关闭连接
		client.Close()

		log.Printf("Client unregistered: UserID=%d, UserType=%d", client.UserID, client.UserType)
	}
}

// 广播消息给所有客户端
func (h *Hub) broadcastMessage(message []byte) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	for client := range h.clients {
		select {
		case client.Send <- message:
			// 消息发送成功
		default:
			// 发送失败，关闭连接
			close(client.Send)
			delete(h.clients, client)

			// 从用户索引中移除
			userKey := getUserKeyByID(client.UserID, client.UserType)
			if c, exists := h.userClients[userKey]; exists && c == client {
				delete(h.userClients, userKey)
			}
		}
	}
}

// 发送消息给特定用户（通过字符串ID）
func (h *Hub) SendToUserByStr(userIDStr string, userType uint8, message []byte) bool {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	userKey := getUserKey(userIDStr, userType)
	if client, exists := h.userClients[userKey]; exists {
		select {
		case client.Send <- message:
			return true
		default:
			// 发送失败，关闭连接
			client.Close()
			delete(h.clients, client)
			delete(h.userClients, userKey)
			return false
		}
	}
	return false
}

// 发送连接成功事件
func (h *Hub) sendConnectEvent(client *WSClient) {
	// 创建连接事件消息
	message := models.WSMessage{
		Event:     consts.EventConnect,
		Timestamp: time.Now(),
		Sender: &models.Sender{
			ID:   client.UserID,
			Type: client.UserType,
			Name: client.UserName,
		},
	}

	// 序列化消息
	jsonMessage, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling connect event: %v", err)
		return
	}

	// 发送消息
	client.Send <- jsonMessage
}

// 获取用户唯一键（通过字符串ID）
func getUserKey(userID string, userType uint8) string {
	return fmt.Sprintf("%s:%d", userID, userType)
}

// 获取用户唯一键（通过数字ID）
func getUserKeyByID(userID uint64, userType uint8) string {
	return fmt.Sprintf("%d:%d", userID, userType)
}

// 发送消息给特定用户（通过数字ID）
func (h *Hub) SendToUser(userID uint64, userType uint8, message []byte) bool {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	userKey := getUserKeyByID(userID, userType)
	if client, exists := h.userClients[userKey]; exists {
		select {
		case client.Send <- message:
			return true
		default:
			// 发送失败，关闭连接
			client.Close()
			delete(h.clients, client)
			delete(h.userClients, userKey)
			return false
		}
	}
	return false
}
