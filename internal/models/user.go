package models

import (
	"time"
)

// User 用户模型
type User struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;not null" json:"id"`
	Username  string    `gorm:"type:varchar(100);not null;uniqueIndex:idx_username_type" json:"username"`
	Password  string    `gorm:"type:varchar(255);not null" json:"password,omitempty"` // 在JSON序列化时省略密码字段
	UserType  uint8     `gorm:"not null;comment:用户类型：1-用户 2-商家 3-管理员;uniqueIndex:idx_username_type" json:"user_type"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// UserLoginRequest 用户登录请求
type UserLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	UserType uint8  `json:"user_type" binding:"required"`
}

// UserLoginResponse 用户登录响应
type UserLoginResponse struct {
	User  User   `json:"user"`
	Token string `json:"token"`
}

// UserRegisterRequest 用户注册请求
type UserRegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	UserType uint8  `json:"user_type" binding:"required"`
}
