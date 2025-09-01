package service

import (
	"encoding/json"
	"errors"
	"feedback-system/internal/consts"
	"feedback-system/internal/models"
	"feedback-system/internal/repository"
	"feedback-system/pkg/ws"
	"log"
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
	// 检查反馈状态，如果已解决则不允许发送消息
	feedback, err := s.feedbackRepo.FindByID(message.FeedbackID)
	if err != nil {
		return err
	}

	// 状态为3表示已解决
	if feedback.Status == 3 {
		return errors.New("反馈已解决，无法发送新消息")
	}

	// 创建消息
	err = s.messageRepo.Create(message)
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
		// 获取反馈信息以确定参与者
		feedback, err := s.feedbackRepo.FindByID(message.FeedbackID)
		if err != nil {
			return err
		}

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

		// 发送给反馈的创建者（如果不是发送者本人）
		if feedback.CreatorID != message.SenderID {
			log.Printf("发送消息给创建者: UserID=%d, UserType=%d", feedback.CreatorID, feedback.CreatorType)
			s.wsHandler.SendMessageToUser(feedback.CreatorID, feedback.CreatorType, jsonMessage)
		}

		// 发送给反馈的目标用户（如果不是发送者本人）
		if feedback.TargetID != message.SenderID {
			// 将目标类型转换为用户类型
			var targetUserType uint8
			switch feedback.TargetType {
			case 1: // TARGET_TYPE.MERCHANT = 1
				targetUserType = consts.Merchant // USER_TYPE.MERCHANT = 2
			case 2: // TARGET_TYPE.ADMIN = 2
				targetUserType = consts.Admin // USER_TYPE.ADMIN = 3
			default:
				targetUserType = feedback.TargetType
			}
			log.Printf("发送消息给目标用户: UserID=%d, TargetType=%d, UserType=%d", feedback.TargetID, feedback.TargetType, targetUserType)
			s.wsHandler.SendMessageToUser(feedback.TargetID, targetUserType, jsonMessage)
		}

		// 发送给所有管理员（如果发送者不是管理员且目标不是管理员）
		// 修复重复消息问题：只有当反馈目标不是管理员时，才广播给所有管理员
		if message.SenderType != consts.Admin && feedback.TargetType != 2 {
			admins, err := s.userRepo.GetAdmins()
			if err == nil {
				for _, admin := range admins {
					// 避免重复发送给已经作为目标用户接收消息的管理员
					if admin.ID != feedback.TargetID {
						s.wsHandler.SendMessageToUser(admin.ID, consts.Admin, jsonMessage)
					}
				}
			}
		}

		// 同时发送给发送者本人，这样发送者也能看到自己的消息
		s.wsHandler.SendMessageToUser(message.SenderID, message.SenderType, jsonMessage)
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
