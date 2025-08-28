package models

import "time"

type Feedback struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement;not null" json:"id"`
	Title       string    `gorm:"type:varchar(255);not null" json:"title"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	Contact     string    `gorm:"type:varchar(100);default:null;comment:联系方式（手机/邮箱）" json:"contact"`
	CreatorID   uint64    `gorm:"not null" json:"creator_id"`
	CreatorType uint8     `gorm:"not null;comment:创建者类型：1-用户 2-商家 3-管理员" json:"creator_type"`
	CreatorName string    `gorm:"-" json:"creator_name"` // 不存储到数据库，仅用于API返回
	TargetID    uint64    `gorm:"not null;comment:目标ID（商家/管理员ID）" json:"target_id"`
	TargetType  uint8     `gorm:"not null;comment:目标类型：1-商家 2-管理员" json:"target_type"`
	TargetName  string    `gorm:"-" json:"target_name"` // 不存储到数据库，仅用于API返回
	Status      uint8     `gorm:"not null;default:1;comment:状态：1-open 2-in_progress 3-resolved" json:"status"`
	Images      []string  `gorm:"type:json;default:null;comment:初始反馈图片数组（JSON格式存储URL数组）" json:"images,omitempty"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// 数据库映射需求：
// 当数据库字段允许为 NULL 时，对应的 Go 字段应该使用指针类型
// 这样 GORM 能够正确处理 NULL 值的读写
// 这里[]string 空切片，可以为nil
