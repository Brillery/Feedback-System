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
	// 前后端对接说明：所有API请求都以 /api 为前缀
	apiGroup := router.Group("/api")
	{
		// 公开路由（无需认证）
		// 用户相关路由：/api/user/* → internal/handler/user.go
		userHandler.RegisterRoutes(apiGroup)
		// WebSocket路由：/api/ws → pkg/ws/handler.go
		wsHttpHandler.RegisterRoutes(apiGroup)

		// 需要认证的路由（需要Bearer token）
		// 认证中间件：internal/middleware/auth.go AuthMiddleware
		authApi := apiGroup.Group("/")
		authApi.Use(middleware.AuthMiddleware(userService))
		{
			// 所有认证用户都可以访问的路由
			// 反馈相关路由：/api/feedback/* → internal/handler/feedback.go
			feedbackHandler.RegisterRoutes(authApi)
			// 消息相关路由：/api/message/* → internal/handler/feedback_message.go
			messageHandler.RegisterRoutes(authApi)

			// 上传路由：/api/upload/image → internal/handler/upload.go UploadImage()
			authApi.POST("/upload/image", uploadHandler.UploadImage)

			// 特定角色路由（如果需要的话）
			// userApi := authApi.Group("/user")
			// userApi.Use(middleware.RoleMiddleware("user"))
			// {
			//     // 用户专用路由
			// }

			// merchantApi := authApi.Group("/merchant")
			// merchantApi.Use(middleware.RoleMiddleware("merchant"))
			// {
			//     // 商家专用路由
			// }

			// adminApi := authApi.Group("/admin")
			// adminApi.Use(middleware.RoleMiddleware("admin"))
			// {
			//     // 管理员专用路由
			// }
		}
	}

	// 静态文件服务
	router.Static("/static", "./static")

	// 确保上传目录存在
	os.MkdirAll("./static/uploads", 0755)
	router.StaticFile("/", "./static/index.html")
	router.StaticFile("/merchant", "./static/merchant.html")
	router.StaticFile("/admin", "./static/admin.html")
	router.StaticFile("/multi-user", "./static/multi-user.html")
	router.StaticFile("/register.html", "./static/register.html")

	// 启动服务器
	port := "8080"
	log.Printf("Server started on port %s", port)
	if err := router.Run(":" + port); err != nil {
		panic(err)
	}
}
