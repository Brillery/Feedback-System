package handler

import (
	"feedback-system/internal/models"
	"feedback-system/internal/service"

	// "net/http"

	"github.com/gin-gonic/gin"
)

// UserHandler 用户处理程序
type UserHandler struct {
	userService service.UserService
}

// NewUserHandler 创建用户处理程序实例
func NewUserHandler(userService service.UserService) *UserHandler {
	return &UserHandler{
		userService: userService,
	}
}

// RegisterRoutes 注册路由
func (h *UserHandler) RegisterRoutes(router *gin.RouterGroup) {
	userGroup := router.Group("/user")
	{
		userGroup.POST("/register", h.Register)
		userGroup.POST("/login", h.Login)
		userGroup.GET("/me", h.GetCurrentUser)
	}
}

// Register 用户注册
func (h *UserHandler) Register(c *gin.Context) {
	var req models.UserRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "无效的请求参数: "+err.Error())
		return
	}

	// 验证用户类型
	if req.UserType != "user" && req.UserType != "merchant" && req.UserType != "admin" {
		BadRequest(c, "无效的用户类型")
		return
	}

	// 注册用户
	user, err := h.userService.Register(&req)
	if err != nil {
		BadRequest(c, "注册失败: "+err.Error())
		return
	}

	// 隐藏密码
	user.Password = ""

	Success(c, user)
}

// Login 用户登录
func (h *UserHandler) Login(c *gin.Context) {
	var req models.UserLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "无效的请求参数: "+err.Error())
		return
	}

	// 验证用户类型
	if req.UserType != "user" && req.UserType != "merchant" && req.UserType != "admin" {
		BadRequest(c, "无效的用户类型")
		return
	}

	// 登录用户
	response, err := h.userService.Login(&req)
	if err != nil {
		Unauthorized(c, "登录失败: "+err.Error())
		return
	}

	// 隐藏密码
	response.User.Password = ""

	Success(c, response)
}

// GetCurrentUser 获取当前用户信息
func (h *UserHandler) GetCurrentUser(c *gin.Context) {
	// 从上下文中获取用户信息
	user, exists := c.Get("user")
	if !exists {
		Unauthorized(c, "未认证")
		return
	}

	// 类型断言
	userObj, ok := user.(*models.User)
	if !ok {
		ServerError(c, "用户类型断言失败")
		return
	}

	// 隐藏密码
	userObj.Password = ""

	Success(c, userObj)
}
