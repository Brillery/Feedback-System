package service

import (
	"encoding/json"
	"feedback-system/internal/consts"
	"feedback-system/internal/models"
	"feedback-system/internal/repository"
	"feedback-system/pkg/ws"
	"time"
)

// FeedbackService 反馈服务接口
type FeedbackService interface {
	// 创建反馈
	Create(feedback *models.Feedback) error

	// 获取反馈详情
	GetByID(id uint64) (*models.Feedback, error)

	// 获取角色创建的反馈列表
	GetByCreator(creatorID uint64, creatorType uint8) ([]*models.Feedback, error)

	// 获取目标接收的反馈列表
	GetByTarget(targetID uint64, targetType uint8) ([]*models.Feedback, error)

	// 获取所有反馈
	GetAll() ([]*models.Feedback, error)

	// 更新反馈状态
	UpdateStatus(id uint64, status uint8, userID uint64, userType uint8) error

	// 删除反馈
	Delete(id uint64) error
}

// feedbackService 反馈服务实现
type feedbackService struct {
	feedbackRepo repository.FeedbackRepository
	wsHandler    *ws.WSHandler
}

// NewFeedbackService 创建反馈服务
func NewFeedbackService(repo repository.FeedbackRepository, wsHandler *ws.WSHandler) FeedbackService {
	return &feedbackService{
		feedbackRepo: repo,
		wsHandler:    wsHandler,
	}
}

// Create 创建反馈
func (s *feedbackService) Create(feedback *models.Feedback) error {
	// 创建反馈
	err := s.feedbackRepo.Create(feedback)
	if err != nil {
		return err
	}

	// 如果有WebSocket处理程序，发送通知
	if s.wsHandler != nil {
		// 创建通知消息
		message := models.WSMessage{
			Event:     consts.EventMessage,
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   feedback.CreatorID,
				Type: feedback.CreatorType,
				Name: "", // 这里需要从用户服务获取用户名
			},
			Receiver: &models.Receiver{
				ID:   feedback.TargetID,
				Type: feedback.TargetType,
				Name: "", // 这里需要从用户服务获取用户名
			},
			Data: &models.MessageData{
				FeedbackID:  feedback.ID,
				ContentType: consts.TextMessage,
				Content:     "新的反馈: " + feedback.Title,
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(message)
		if err != nil {
			return err
		}

		// 发送消息给目标用户
		s.wsHandler.SendMessageToUser(feedback.TargetID, feedback.TargetType, jsonMessage)
	}

	return nil
}

// GetByID 获取反馈详情
func (s *feedbackService) GetByID(id uint64) (*models.Feedback, error) {
	return s.feedbackRepo.FindByID(id)
}

// GetByCreator 获取用户创建的反馈列表
func (s *feedbackService) GetByCreator(creatorID uint64, creatorType uint8) ([]*models.Feedback, error) {
	return s.feedbackRepo.FindByCreator(creatorID, creatorType)
}

// GetByTarget 获取目标接收的反馈列表
func (s *feedbackService) GetByTarget(targetID uint64, targetType uint8) ([]*models.Feedback, error) {
	return s.feedbackRepo.FindByTarget(targetID, targetType)
}

// GetAll 获取所有反馈
func (s *feedbackService) GetAll() ([]*models.Feedback, error) {
	return s.feedbackRepo.FindAll()
}

// UpdateStatus 更新反馈状态
func (s *feedbackService) UpdateStatus(id uint64, status uint8, userID uint64, userType uint8) error {
	// 获取反馈
	feedback, err := s.feedbackRepo.FindByID(id)
	if err != nil {
		return err
	}

	// 更新状态
	oldStatus := feedback.Status
	err = s.feedbackRepo.UpdateStatus(id, status)
	if err != nil {
		return err
	}

	// 如果有WebSocket处理程序，发送通知
	if s.wsHandler != nil {
		// 创建状态变更消息
		message := models.WSMessage{
			Event:     consts.EventStatusChange,
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   userID,
				Type: userType,
				Name: "", // 这里需要从用户服务获取用户名
			},
			Data: &models.StatusChangeData{
				FeedbackID: id,
				OldStatus:  oldStatus,
				NewStatus:  status,
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(message)
		if err != nil {
			return err
		}

		// 广播状态变更消息
		s.wsHandler.BroadcastMessage(jsonMessage)
	}

	return nil
}

// Delete 删除反馈
func (s *feedbackService) Delete(id uint64) error {
	return s.feedbackRepo.Delete(id)
}
