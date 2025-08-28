package models

import "time"

// WSMessage WebSocket消息结构
type WSMessage struct {
	Event     string      `json:"event"`
	Timestamp time.Time   `json:"timestamp"`
	Sender    *Sender     `json:"sender,omitempty"`
	Receiver  *Receiver   `json:"receiver,omitempty"`
	Data      interface{} `json:"data,omitempty"`
}

// Sender 发送者信息
type Sender struct {
	ID   uint64 `json:"id"`
	Type uint8  `json:"type"`
	Name string `json:"name"`
}

// Receiver 接收者信息
type Receiver struct {
	ID   uint64 `json:"id"`
	Type uint8  `json:"type"`
	Name string `json:"name"`
}

// MessageData 消息数据
type MessageData struct {
	FeedbackID  uint64 `json:"feedback_id"`
	MessageID   uint64 `json:"message_id"`
	ContentType uint8  `json:"content_type"`
	Content     string `json:"content"`
}

// StatusChangeData 状态变更数据
type StatusChangeData struct {
	FeedbackID uint64 `json:"feedback_id"`
	OldStatus  uint8  `json:"old_status"`
	NewStatus  uint8  `json:"new_status"`
}

// TypingData 正在输入数据
type TypingData struct {
	FeedbackID uint64 `json:"feedback_id"`
	IsTyping   bool   `json:"is_typing"`
}

// ReadData 已读数据
type ReadData struct {
	MessageID uint64 `json:"message_id"`
}

// FeedbackDeleteData 反馈删除数据
type FeedbackDeleteData struct {
	FeedbackID uint64 `json:"feedback_id"`
}
