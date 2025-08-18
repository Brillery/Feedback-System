package main

import (
	"feedback-system/internal/repository"
	"feedback-system/pkg/db"
)

func main() {
	// 连接数据库
	dsn := "root:123456@tcp(localhost:3306)/feedback_system?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := db.NewDB(dsn)
	if err != nil {
		panic(err)
	}

	// 初始化 repositories
	feedbackRepo := repository.NewFeedbackRepository(db)

	// 初始化 service

	// 初始化 handler

	// 设置路由

	// 启动服务器
	port := "8080"
}
