package models

import "time"

type FeedbackMessage struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement;not null" json:"id"`
	FeedbackID  uint64    `gorm:"not null;index:idx_feedback" json:"feedback_id"`
	SenderID    uint64    `gorm:"not null" json:"sender_id"`
	SenderType  uint8     `gorm:"not null;comment:发送者类型：1-用户 2-商家 3-管理员" json:"sender_type"`
	ContentType uint8     `gorm:"not null;comment:内容类型：1-文本 2-图片 3-图片数组" json:"content_type"`
	Content     string    `gorm:"type:text;not null;comment:消息内容（文本内容或JSON格式的图片URL数组）" json:"content"`
	IsRead      uint8     `gorm:"not null;default:0;comment:是否已读：0-未读 1-已读" json:"is_read"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
}
