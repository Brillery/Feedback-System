package service

import (
	"encoding/json"
	"feedback-system/internal/consts"
	"feedback-system/internal/models"
	"feedback-system/internal/repository"
	"feedback-system/pkg/ws"
	"time"
)

// FeedbackMessageService 反馈消息服务接口
type FeedbackMessageService interface {
	// 创建反馈消息
	Create(message *models.FeedbackMessage) error

	// 获取反馈的所有消息
	GetByFeedbackID(feedbackID uint64) ([]*models.FeedbackMessage, error)

	// 标记消息为已读
	MarkAsRead(id uint64)

	// 删除消息
	Delete(id uint64) error
}

// feedbackMessageService 反馈消息服务实现
type feedbackMessageService struct {
	messageRepo  repository.FeedbackMessageRepository
	feedbackRepo repository.FeedbackRepository
	userRepo     repository.UserRepository
	wsHandler    *ws.WSHandler
}

// NewFeedbackMessageService 创建反馈消息服务
func NewFeedbackMessageService(repo repository.FeedbackMessageRepository, feedbackRepo repository.FeedbackRepository, userRepo repository.UserRepository, wsHandler *ws.WSHandler) FeedbackMessageService {
	return &feedbackMessageService{
		messageRepo:  repo,
		feedbackRepo: feedbackRepo,
		userRepo:     userRepo,
		wsHandler:    wsHandler,
	}
}

// Create 创建反馈消息
func (s *feedbackMessageService) Create(message *models.FeedbackMessage) error {
	// 创建消息
	err := s.messageRepo.Create(message)
	if err != nil {
		return err
	}

	// 检查是否需要自动更新反馈状态
	// 如果是目标方（商家或管理员）首次回复，将状态更新为"处理中"
	if s.shouldUpdateFeedbackStatus(message) {
		s.updateFeedbackStatusToInProgress(message.FeedbackID)
	}

	// 如果有WebSocket处理程序，发送通知
	if s.wsHandler != nil {
		// 获取接收者信息（这里需要根据实际情况确定接收者）
		// 在实际应用中，可能需要查询数据库获取反馈的创建者和目标信息
		// 这里简化处理，假设接收者是所有相关用户

		// 获取发送者用户名
		var senderName string
		if s.userRepo != nil {
			sender, err := s.userRepo.GetByID(message.SenderID)
			if err == nil && sender != nil {
				senderName = sender.Username
			}
		}

		// 创建WebSocket消息（使用前端期望的字段格式）
		wsMessage := models.WSMessage{
			Event:     consts.EventMessage,
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   message.SenderID,
				Type: message.SenderType,
				Name: senderName,
			},
			Data: map[string]interface{}{
				"feedbackId":  message.FeedbackID, // 使用驼峰格式
				"messageId":   message.ID,
				"content":     message.Content,
				"messageType": message.ContentType,
				"createdAt":   message.CreatedAt,
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(wsMessage)
		if err != nil {
			return err
		}

		// 广播消息
		// 在实际应用中，应该只发送给相关用户，而不是广播
		s.wsHandler.BroadcastMessage(jsonMessage)
	}

	return nil
}

// GetByFeedbackID 获取反馈的所有消息
func (s *feedbackMessageService) GetByFeedbackID(feedbackID uint64) ([]*models.FeedbackMessage, error) {
	messages, err := s.messageRepo.FindAllByFeedbackID(feedbackID)
	if err != nil {
		return nil, err
	}

	// 为每条消息添加发送者姓名
	for _, message := range messages {
		if s.userRepo != nil {
			sender, err := s.userRepo.GetByID(message.SenderID)
			if err == nil && sender != nil {
				// 添加发送者姓名到消息中（需要在模型中添加这个字段）
				message.SenderName = sender.Username
			}
		}
	}

	return messages, nil
}

// MarkAsRead 标记消息为已读
func (s *feedbackMessageService) MarkAsRead(id uint64) {
	// 标记为已读
	s.messageRepo.MarkAsRead(id)

	// 如果有WebSocket处理程序，发送已读通知
	if s.wsHandler != nil {
		// 这里需要获取消息详情，以便发送已读通知
		// 简化处理，直接创建已读通知

		// 创建已读通知
		wsMessage := models.WSMessage{
			Event:     consts.EventRead,
			Timestamp: time.Now(),
			Data: &models.ReadData{
				MessageID: id,
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(wsMessage)
		if err != nil {
			return
		}

		// 广播已读通知
		s.wsHandler.BroadcastMessage(jsonMessage)
	}
}

// Delete 删除消息
func (s *feedbackMessageService) Delete(id uint64) error {
	return s.messageRepo.Delete(id)
}

// shouldUpdateFeedbackStatus 检查是否需要自动更新反馈状态
func (s *feedbackMessageService) shouldUpdateFeedbackStatus(message *models.FeedbackMessage) bool {
	// 获取反馈信息
	feedback, err := s.getFeedbackInfo(message.FeedbackID)
	if err != nil {
		return false
	}

	// 只有当反馈状态为"待处理"(1)时，且消息发送者是目标方时，才自动更新状态
	if feedback.Status == 1 { // 待处理状态
		// 检查发送者是否是反馈的目标方
		// 目标类型1=商家，目标类型2=管理员
		// 发送者类型1=用户，发送者类型2=商家，发送者类型3=管理员
		if (feedback.TargetType == 1 && message.SenderType == 2) || // 目标是商家，发送者是商家
			(feedback.TargetType == 2 && message.SenderType == 3) { // 目标是管理员，发送者是管理员
			return true
		}
	}

	return false
}

// updateFeedbackStatusToInProgress 将反馈状态更新为处理中
func (s *feedbackMessageService) updateFeedbackStatusToInProgress(feedbackID uint64) {
	// 将反馈状态更新为处理中(2)
	err := s.feedbackRepo.UpdateStatus(feedbackID, 2)
	if err != nil {
		// 记录错误但不影响消息创建
		// 在实际项目中应该使用日志记录
		return
	}

	// 发送状态变更通知
	if s.wsHandler != nil {
		// 创建状态变更消息
		message := models.WSMessage{
			Event:     consts.EventStatusChange,
			Timestamp: time.Now(),
			Data: &models.StatusChangeData{
				FeedbackID: feedbackID,
				OldStatus:  1, // 待处理
				NewStatus:  2, // 处理中
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(message)
		if err == nil {
			// 广播状态变更消息
			s.wsHandler.BroadcastMessage(jsonMessage)
		}
	}
}

// getFeedbackInfo 获取反馈信息的辅助方法
func (s *feedbackMessageService) getFeedbackInfo(feedbackID uint64) (*models.Feedback, error) {
	return s.feedbackRepo.FindByID(feedbackID)
}
