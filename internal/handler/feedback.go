package handler

import (
	"feedback-system/internal/models"
	"feedback-system/internal/service"

	"github.com/gin-gonic/gin"

	// "net/http"
	"strconv"
)

// FeedbackHandler 反馈处理程序
type FeedbackHandler struct {
	feedbackService service.FeedbackService
}

// NewFeedbackHandler 创建反馈处理程序
func NewFeedbackHandler(feedbackService service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{
		feedbackService: feedbackService,
	}
}

// Create 创建反馈
func (h *FeedbackHandler) Create(c *gin.Context) {
	// 解析请求参数
	var feedback models.Feedback
	if err := c.ShouldBindJSON(&feedback); err != nil {
		BadRequest(c, "Invalid request parameters: "+err.Error())
		return
	}

	// 从请求头或会话中获取用户信息
	// 在实际应用中，这里应该从认证中间件中获取用户信息
	userID, _ := strconv.ParseUint(c.GetHeader("X-User-ID"), 10, 64)
	userType, _ := strconv.ParseUint(c.GetHeader("X-User-Type"), 10, 8)

	// 设置创建者信息
	feedback.CreatorID = userID
	feedback.CreatorType = uint8(userType)

	// 创建反馈
	err := h.feedbackService.Create(&feedback)
	if err != nil {
		ServerError(c, "Failed to create feedback: "+err.Error())
		return
	}

	Success(c, feedback)
}

// GetByID 获取反馈详情
func (h *FeedbackHandler) GetByID(c *gin.Context) {
	// 解析请求参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		BadRequest(c, "Invalid feedback ID")
		return
	}

	// 获取反馈详情
	feedback, err := h.feedbackService.GetByID(id)
	if err != nil {
		NotFound(c, "Feedback not found")
		return
	}

	Success(c, feedback)
}

// GetByCreator 获取用户创建的反馈列表
func (h *FeedbackHandler) GetByCreator(c *gin.Context) {
	// 解析请求参数
	creatorID, err := strconv.ParseUint(c.Query("creator_id"), 10, 64)
	if err != nil || creatorID == 0 {
		BadRequest(c, "Invalid creator ID")
		return
	}

	creatorType, err := strconv.ParseUint(c.Query("creator_type"), 10, 8)
	if err != nil || creatorType < 1 || creatorType > 3 {
		BadRequest(c, "Invalid creator type")
		return
	}

	// 获取反馈列表
	feedbacks, err := h.feedbackService.GetByCreator(creatorID, uint8(creatorType))
	if err != nil {
		ServerError(c, "Failed to get feedbacks: "+err.Error())
		return
	}

	Success(c, feedbacks)
}

// GetByTarget 获取目标接收的反馈列表
func (h *FeedbackHandler) GetByTarget(c *gin.Context) {
	// 解析请求参数
	targetID, err := strconv.ParseUint(c.Query("target_id"), 10, 64)
	if err != nil || targetID == 0 {
		BadRequest(c, "Invalid target ID")
		return
	}

	targetType, err := strconv.ParseUint(c.Query("target_type"), 10, 8)
	if err != nil || targetType < 1 || targetType > 2 {
		BadRequest(c, "Invalid target type")
		return
	}

	// 获取反馈列表
	feedbacks, err := h.feedbackService.GetByTarget(targetID, uint8(targetType))
	if err != nil {
		ServerError(c, "Failed to get feedbacks: "+err.Error())
		return
	}

	Success(c, feedbacks)
}

// GetAll 获取所有反馈
func (h *FeedbackHandler) GetAll(c *gin.Context) {
	// 获取所有反馈
	feedbacks, err := h.feedbackService.GetAll()
	if err != nil {
		ServerError(c, "Failed to get feedbacks: "+err.Error())
		return
	}

	Success(c, feedbacks)
}

// UpdateStatus 更新反馈状态
func (h *FeedbackHandler) UpdateStatus(c *gin.Context) {
	// 解析请求参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		BadRequest(c, "Invalid feedback ID")
		return
	}

	var req struct {
		Status uint8 `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		BadRequest(c, "Invalid request parameters: "+err.Error())
		return
	}

	// 从请求头或会话中获取用户信息
	userID, _ := strconv.ParseUint(c.GetHeader("X-User-ID"), 10, 64)
	userType, _ := strconv.ParseUint(c.GetHeader("X-User-Type"), 10, 8)

	// 更新状态
	err = h.feedbackService.UpdateStatus(id, req.Status, userID, uint8(userType))
	if err != nil {
		ServerError(c, "Failed to update status: "+err.Error())
		return
	}

	Success(c, gin.H{"id": id, "status": req.Status})
}

// Delete 删除反馈
func (h *FeedbackHandler) Delete(c *gin.Context) {
	// 解析请求参数
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		BadRequest(c, "Invalid feedback ID")
		return
	}

	// 删除反馈
	err = h.feedbackService.Delete(id)
	if err != nil {
		ServerError(c, "Failed to delete feedback: "+err.Error())
		return
	}

	Success(c, gin.H{"id": id})
}

// RegisterRoutes 注册路由
func (h *FeedbackHandler) RegisterRoutes(router *gin.RouterGroup) {
	feedbackRouter := router.Group("/feedback")
	{
		feedbackRouter.POST("", h.Create)                 // 创建反馈
		feedbackRouter.GET("/:id", h.GetByID)             // 获取反馈详情
		feedbackRouter.GET("/creator", h.GetByCreator)    // 获取用户创建的反馈列表
		feedbackRouter.GET("/target", h.GetByTarget)      // 获取目标接收的反馈列表
		feedbackRouter.GET("", h.GetAll)                  // 获取所有反馈
		feedbackRouter.PUT("/:id/status", h.UpdateStatus) // 更新反馈状态
		feedbackRouter.DELETE("/:id", h.Delete)           // 删除反馈
	}
}
