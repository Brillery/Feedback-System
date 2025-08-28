package main

import (
	"feedback-system/internal/handler"
	"feedback-system/internal/middleware"
	"feedback-system/internal/repository"
	"feedback-system/internal/service"
	"feedback-system/pkg/db"
	"feedback-system/pkg/ws"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
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
	messageRepo := repository.NewFeedbackMessageRepository(db)
	userRepo := repository.NewUserRepository(db)

	// 初始化 WebSocket 处理程序
	wsHandler := ws.NewWSHandler()

	// 初始化 service
	feedbackService := service.NewFeedbackService(feedbackRepo, messageRepo, userRepo, wsHandler)
	messageService := service.NewFeedbackMessageService(messageRepo, feedbackRepo, userRepo, wsHandler)
	userService := service.NewUserService(userRepo)

	// 初始化 handler
	feedbackHandler := handler.NewFeedbackHandler(feedbackService)
	messageHandler := handler.NewFeedbackMessageHandler(messageService)
	wsHttpHandler := handler.NewWSHandler(wsHandler)
	userHandler := handler.NewUserHandler(userService)
	uploadHandler := handler.NewUploadHandler()

	// 设置路由
	router := gin.Default()

	// 设置受信任的代理
	router.SetTrustedProxies([]string{"127.0.0.1", "::1"})

	// 设置跨域中间件
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-User-ID, X-User-Type")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// API 路由组
	apiGroup := router.Group("/api")
	{
		// 公开路由
		userHandler.RegisterRoutes(apiGroup)
		wsHttpHandler.RegisterRoutes(apiGroup)

		// 需要认证的路由
		authApi := apiGroup.Group("/")
		authApi.Use(middleware.AuthMiddleware(userService))
		{
			// 用户路由
			userApi := authApi.Group("/")
			userApi.Use(middleware.RoleMiddleware("user"))
			{
				// 用户可以创建反馈和发送消息
			}

			// 商家路由
			merchantApi := authApi.Group("/")
			merchantApi.Use(middleware.RoleMiddleware("merchant"))
			{
				// 商家可以查看和回复反馈
			}

			// 管理员路由
			adminApi := authApi.Group("/")
			adminApi.Use(middleware.RoleMiddleware("admin"))
			{
				// 管理员可以管理所有内容
			}

			// 所有认证用户都可以访问的路由
			feedbackHandler.RegisterRoutes(authApi)
			messageHandler.RegisterRoutes(authApi)

			// 上传路由
			authApi.POST("/upload/image", uploadHandler.UploadImage)
		}
	}

	// 静态文件服务
	router.Static("/static", "./static")

	// 确保上传目录存在
	os.MkdirAll("./static/uploads", 0755)
	router.StaticFile("/", "./static/index.html")
	router.StaticFile("/merchant", "./static/merchant.html")
	router.StaticFile("/admin", "./static/admin.html")
	router.StaticFile("/test.html", "./static/test.html")

	// 启动服务器
	port := "8080"
	log.Printf("Server started on port %s", port)
	if err := router.Run(":" + port); err != nil {
		panic(err)
	}
}
