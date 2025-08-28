package handler

import (
	"feedback-system/internal/models"
	"feedback-system/internal/service"

	"github.com/gin-gonic/gin"

	// "net/http"
	"strconv"
)

// FeedbackMessageHandler 反馈消息处理程序
type FeedbackMessageHandler struct {
	messageService service.FeedbackMessageService
}

// NewFeedbackMessageHandler 创建反馈消息处理程序
func NewFeedbackMessageHandler(messageService service.FeedbackMessageService) *FeedbackMessageHandler {
	return &FeedbackMessageHandler{
		messageService: messageService,
	}
}

// Create 创建反馈消息
func (h *FeedbackMessageHandler) Create(c *gin.Context) {
	// 解析请求参数
	var message models.FeedbackMessage
	if err := c.ShouldBindJSON(&message); err != nil {
		BadRequest(c, "Invalid request parameters: "+err.Error())
		return
	}

	// 从认证中间件中获取用户信息
	user, exists := c.Get("user")
	if !exists {
		Unauthorized(c, "未认证")
		return
	}

	userObj, ok := user.(*models.User)
	if !ok {
		ServerError(c, "用户类型断言失败")
		return
	}

	// 设置发送者信息
	message.SenderID = userObj.ID
	message.SenderType = userObj.UserType

	// 创建消息
	err := h.messageService.Create(&message)
	if err != nil {
		ServerError(c, "Failed to create message: "+err.Error())
		return
	}

	Success(c, message)
}

// GetByFeedbackID 获取反馈的所有消息
func (h *FeedbackMessageHandler) GetByFeedbackID(c *gin.Context) {
	// 解析请求参数
	feedbackID, err := strconv.ParseUint(c.Param("feedback_id"), 10, 64)
	if err != nil {
		BadRequest(c, "Invalid feedback ID")
		return
	}

	// 获取消息列表
	messages, err := h.messageService.GetByFeedbackID(feedbackID)
	if err != nil {
		ServerError(c, "Failed to get messages: "+err.Error())
		return
	}

	Success(c, messages)
}

// MarkAsRead 标记消息为已读
func (h *FeedbackMessageHandler) MarkAsRead(c *gin.Context) {
	// 解析请求参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		BadRequest(c, "Invalid message ID")
		return
	}

	// 标记为已读
	h.messageService.MarkAsRead(id)

	Success(c, gin.H{"id": id})
}

// Delete 删除消息
func (h *FeedbackMessageHandler) Delete(c *gin.Context) {
	// 解析请求参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		BadRequest(c, "Invalid message ID")
		return
	}

	// 删除消息
	err = h.messageService.Delete(id)
	if err != nil {
		ServerError(c, "Failed to delete message: "+err.Error())
		return
	}

	Success(c, gin.H{"id": id})
}

// RegisterRoutes 注册路由
func (h *FeedbackMessageHandler) RegisterRoutes(router *gin.RouterGroup) {
	messageRouter := router.Group("/message")
	{
		messageRouter.POST("", h.Create)                               // 创建消息
		messageRouter.GET("/feedback/:feedback_id", h.GetByFeedbackID) // 获取反馈的所有消息
		messageRouter.PUT("/:id/read", h.MarkAsRead)                   // 标记消息为已读
		messageRouter.DELETE("/:id", h.Delete)                         // 删除消息
	}
}

// getUserTypeNumber 将用户类型字符串转换为数字
//func getUserTypeNumber(userType string) uint8 {
//	switch userType {
//	case "user":
//		return 1
//	case "merchant":
//		return 2
//	case "admin":
//		return 3
//	default:
//		return 1
//	}
//}
