package models

import (
	"time"
)

// User 用户模型
type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"password,omitempty"` // 在JSON序列化时省略密码字段
	UserType  string    `json:"user_type"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserLoginRequest 用户登录请求
type UserLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	UserType string `json:"user_type" binding:"required"`
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
	UserType string `json:"user_type" binding:"required"`
}
