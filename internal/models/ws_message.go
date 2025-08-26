package models

import "time"

// WSMessage WebSocket消息结构
type WSMessage struct {
	Event     string      `json:"event"`              // 事件类型
	Timestamp time.Time   `json:"timestamp"`          // 时间戳
	Sender    *Sender     `json:"sender,omitempty"`   // 发送者信息
	Receiver  *Receiver   `json:"receiver,omitempty"` // 接收者信息
	Data      interface{} `json:"data,omitempty"`     // 消息数据
}

// Sender 发送者信息
type Sender struct {
	ID   uint64 `json:"id"`   // 发送者ID
	Type uint8  `json:"type"` // 发送者类型：1-用户 2-商家 3-管理员
	Name string `json:"name"` // 发送者名称
}

// Receiver 接收者信息
type Receiver struct {
	ID   uint64 `json:"id"`   // 接收者ID
	Type uint8  `json:"type"` // 接收者类型：1-用户 2-商家 3-管理员
	Name string `json:"name"` // 接收者名称
}

// MessageData 消息数据
type MessageData struct {
	FeedbackID  uint64 `json:"feedback_id"`  // 反馈ID
	MessageID   uint64 `json:"message_id"`   // 消息ID
	ContentType uint8  `json:"content_type"` // 内容类型：1-文本 2-图片 3-图片数组
	Content     string `json:"content"`      // 消息内容
}

// StatusChangeData 状态变更数据
type StatusChangeData struct {
	FeedbackID uint64 `json:"feedback_id"` // 反馈ID
	OldStatus  uint8  `json:"old_status"`  // 旧状态
	NewStatus  uint8  `json:"new_status"`  // 新状态
}

// TypingData 正在输入数据
type TypingData struct {
	FeedbackID uint64 `json:"feedback_id"` // 反馈ID
}

// ReadData 已读数据
type ReadData struct {
	FeedbackID uint64 `json:"feedback_id"` // 反馈ID
	MessageID  uint64 `json:"message_id"`  // 消息ID
}