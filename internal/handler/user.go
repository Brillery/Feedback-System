package handler

import (
	"feedback-system/internal/models"
	"feedback-system/internal/service"
	"strconv"

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
// 前后端对接说明：
// - 这些路由对应前端 CONFIG.ENDPOINTS.USER 中定义的端点
// - 前端通过 HttpUtils.post() 和 HttpUtils.get() 调用这些接口
func (h *UserHandler) RegisterRoutes(router *gin.RouterGroup) {
	userGroup := router.Group("/user")
	{
		// POST /api/user/register ← 前端：user.js, merchant.js, admin.js 注册功能
		userGroup.POST("/register", h.Register)
		// POST /api/user/login ← 前端：user.js handleLogin(), merchant.js handleLogin(), admin.js handleLogin()
		userGroup.POST("/login", h.Login)
		// GET /api/user/me ← 前端：checkLoginStatus() 验证token有效性
		userGroup.GET("/me", h.GetCurrentUser)
		// GET /api/user/merchants ← 前端：user.js 创建反馈时获取商家列表
		userGroup.GET("/merchants", h.GetMerchants)
		// GET /api/user/info ← 前端：获取用户详细信息（包括联系方式）
		userGroup.GET("/info", h.GetUserInfo)
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
	if req.UserType != 1 && req.UserType != 2 && req.UserType != 3 {
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
// 前后端对接说明：
// - 前端调用：HttpUtils.post(CONFIG.ENDPOINTS.USER.LOGIN, {username, password, user_type})
// - 请求数据：{username: string, password: string, user_type: number}
// - 响应数据：{code: 200, message: "success", data: {user: User对象, token: string}}
// - 用户类型：1=用户, 2=商家, 3=管理员
func (h *UserHandler) Login(c *gin.Context) {
	var req models.UserLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "无效的请求参数: "+err.Error())
		return
	}

	// 验证用户类型
	if req.UserType != 1 && req.UserType != 2 && req.UserType != 3 {
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
// 前后端对接说明：
// - 前端调用：HttpUtils.get(CONFIG.ENDPOINTS.USER.CURRENT) 在checkLoginStatus()中
// - 需要认证：Authorization头必须包含 "Bearer {token}"
// - 响应数据：{code: 200, message: "success", data: User对象}
// - 用途：验证token有效性，获取当前登录用户信息
func (h *UserHandler) GetCurrentUser(c *gin.Context) {
	// 从上下文中获取用户信息（由AuthMiddleware设置）
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

// GetMerchants 获取商家列表
func (h *UserHandler) GetMerchants(c *gin.Context) {
	merchants, err := h.userService.GetMerchants()
	if err != nil {
		ServerError(c, "获取商家列表失败: "+err.Error())
		return
	}

	// 隐藏密码
	for _, merchant := range merchants {
		merchant.Password = ""
	}

	Success(c, merchants)
}

// GetUserInfo 获取用户信息（包括联系方式）
func (h *UserHandler) GetUserInfo(c *gin.Context) {
	// 获取查询参数
	idStr := c.Query("id")
	typeStr := c.Query("type")

	if idStr == "" || typeStr == "" {
		BadRequest(c, "缺少必要参数")
		return
	}

	// 解析参数
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		BadRequest(c, "无效的用户ID")
		return
	}

	userType, err := strconv.ParseUint(typeStr, 10, 8)
	if err != nil {
		BadRequest(c, "无效的用户类型")
		return
	}

	// 获取用户信息
	user, err := h.userService.GetUserByID(id)
	if err != nil {
		NotFound(c, "用户不存在")
		return
	}

	// 验证用户类型匹配
	if user.UserType != uint8(userType) {
		BadRequest(c, "用户类型不匹配")
		return
	}

	// 隐藏密码
	user.Password = ""

	Success(c, user)
}
