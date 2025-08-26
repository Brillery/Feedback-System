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
	messageRepo repository.FeedbackMessageRepository
	wsHandler   *ws.WSHandler
}

// NewFeedbackMessageService 创建反馈消息服务
func NewFeedbackMessageService(repo repository.FeedbackMessageRepository, wsHandler *ws.WSHandler) FeedbackMessageService {
	return &feedbackMessageService{
		messageRepo: repo,
		wsHandler:   wsHandler,
	}
}

// Create 创建反馈消息
func (s *feedbackMessageService) Create(message *models.FeedbackMessage) error {
	// 创建消息
	err := s.messageRepo.Create(message)
	if err != nil {
		return err
	}
	
	// 如果有WebSocket处理程序，发送通知
	if s.wsHandler != nil {
		// 获取接收者信息（这里需要根据实际情况确定接收者）
		// 在实际应用中，可能需要查询数据库获取反馈的创建者和目标信息
		// 这里简化处理，假设接收者是所有相关用户
		
		// 创建WebSocket消息
		wsMessage := models.WSMessage{
			Event:     consts.EventMessage,
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   message.SenderID,
				Type: message.SenderType,
				Name: "", // 这里需要从用户服务获取用户名
			},
			Data: &models.MessageData{
				FeedbackID:  message.FeedbackID,
				MessageID:   message.ID,
				ContentType: message.ContentType,
				Content:     message.Content,
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
	return s.messageRepo.FindAllByFeedbackID(feedbackID)
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