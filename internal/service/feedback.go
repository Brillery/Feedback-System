package service

import (
	"encoding/json"
	"feedback-system/internal/consts"
	"feedback-system/internal/models"
	"feedback-system/internal/repository"
	"feedback-system/pkg/ws"
	"fmt"
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
	Delete(id uint64, userID uint64, userType uint8) error
}

// feedbackService 反馈服务实现
type feedbackService struct {
	feedbackRepo repository.FeedbackRepository
	messageRepo  repository.FeedbackMessageRepository
	userRepo     repository.UserRepository
	wsHandler    *ws.WSHandler
}

// NewFeedbackService 创建反馈服务
func NewFeedbackService(repo repository.FeedbackRepository, messageRepo repository.FeedbackMessageRepository, userRepo repository.UserRepository, wsHandler *ws.WSHandler) FeedbackService {
	return &feedbackService{
		feedbackRepo: repo,
		messageRepo:  messageRepo,
		userRepo:     userRepo,
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

	// 将反馈内容作为第一条消息保存
	if s.messageRepo != nil {
		initialMessage := &models.FeedbackMessage{
			FeedbackID:  feedback.ID,
			SenderID:    feedback.CreatorID,
			SenderType:  uint8(feedback.CreatorType),
			ContentType: uint8(consts.TextMessage),
			Content:     feedback.Content,
			IsRead:      0, // 未读
		}

		// 保存初始消息
		s.messageRepo.Create(initialMessage)
	}

	// 如果有WebSocket处理程序，发送通知
	if s.wsHandler != nil {
		// 获取创建者用户名
		var creatorName string
		creator, err := s.userRepo.GetByID(feedback.CreatorID)
		if err == nil && creator != nil {
			creatorName = creator.Username
		}

		// 获取目标用户名
		var targetName string
		target, err := s.userRepo.GetByID(feedback.TargetID)
		if err == nil && target != nil {
			targetName = target.Username
		}

		// 创建新反馈通知消息
		newFeedbackMessage := models.WSMessage{
			Event:     consts.EventNewFeedback, // 使用常量
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   feedback.CreatorID,
				Type: feedback.CreatorType,
				Name: creatorName,
			},
			Receiver: &models.Receiver{
				ID:   feedback.TargetID,
				Type: feedback.TargetType,
				Name: targetName,
			},
			Data: map[string]interface{}{
				"feedback_id":  feedback.ID,
				"title":        feedback.Title,
				"content":      feedback.Content,
				"creator_id":   feedback.CreatorID,
				"creator_type": feedback.CreatorType,
				"creator_name": creatorName,
				"target_id":    feedback.TargetID,
				"target_type":  feedback.TargetType,
				"target_name":  targetName,
				"status":       feedback.Status,
				"created_at":   feedback.CreatedAt,
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(newFeedbackMessage)
		if err != nil {
			return err
		}

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

		// 发送消息给目标用户
		s.wsHandler.SendMessageToUser(feedback.TargetID, targetUserType, jsonMessage)

		// 同时发送给所有管理员（如果目标不是管理员）
		if feedback.TargetType != 2 { // TARGET_TYPE.ADMIN = 2
			admins, err := s.userRepo.GetAdmins()
			if err == nil {
				for _, admin := range admins {
					s.wsHandler.SendMessageToUser(admin.ID, consts.Admin, jsonMessage)
				}
			}
		}
	}

	return nil
}

// GetByID 获取反馈详情
func (s *feedbackService) GetByID(id uint64) (*models.Feedback, error) {
	// 获取反馈基本信息
	feedback, err := s.feedbackRepo.FindByID(id)
	if err != nil {
		return nil, err
	}

	// 获取创建者和目标用户的名称
	// 这里需要调用用户服务获取用户名称
	// 获取创建者信息
	if feedback.CreatorType == consts.User || feedback.CreatorType == consts.Merchant || feedback.CreatorType == consts.Admin {
		creator, err := s.userRepo.GetByID(feedback.CreatorID)
		if err == nil && creator != nil {
			// 添加创建者名称到返回结构中
			feedback.CreatorName = creator.Username
		}
	}

	// 获取目标用户信息
	if feedback.TargetType == consts.Merchant || feedback.TargetType == consts.Admin {
		target, err := s.userRepo.GetByID(feedback.TargetID)
		if err == nil && target != nil {
			// 添加目标用户名称到返回结构中
			feedback.TargetName = target.Username
		}
	}

	return feedback, nil
}

// GetByCreator 获取用户创建的反馈列表
func (s *feedbackService) GetByCreator(creatorID uint64, creatorType uint8) ([]*models.Feedback, error) {
	// 获取反馈列表
	feedbacks, err := s.feedbackRepo.FindByCreator(creatorID, creatorType)
	if err != nil {
		return nil, err
	}

	// 为每个反馈添加创建者和目标用户的名称
	for _, feedback := range feedbacks {
		// 创建者信息已知
		if creatorType == consts.User || creatorType == consts.Merchant || creatorType == consts.Admin {
			creator, err := s.userRepo.GetByID(creatorID)
			if err == nil && creator != nil {
				// 添加创建者名称到返回结构中
				feedback.CreatorName = creator.Username
			}
		}

		// 获取目标用户信息
		if feedback.TargetType == consts.Merchant || feedback.TargetType == consts.Admin {
			target, err := s.userRepo.GetByID(feedback.TargetID)
			if err == nil && target != nil {
				// 添加目标用户名称到返回结构中
				feedback.TargetName = target.Username
			}
		}
	}

	return feedbacks, nil
}

// GetByTarget 获取目标接收的反馈列表
func (s *feedbackService) GetByTarget(targetID uint64, targetType uint8) ([]*models.Feedback, error) {
	// 获取反馈列表
	feedbacks, err := s.feedbackRepo.FindByTarget(targetID, targetType)
	if err != nil {
		return nil, err
	}

	// 为每个反馈添加创建者和目标用户的名称
	for _, feedback := range feedbacks {
		// 获取创建者信息
		if feedback.CreatorType == consts.User || feedback.CreatorType == consts.Merchant || feedback.CreatorType == consts.Admin {
			creator, err := s.userRepo.GetByID(feedback.CreatorID)
			if err == nil && creator != nil {
				// 添加创建者名称到返回结构中
				feedback.CreatorName = creator.Username
			}
		}

		// 目标用户信息已知
		if targetType == consts.Merchant || targetType == consts.Admin {
			target, err := s.userRepo.GetByID(targetID)
			if err == nil && target != nil {
				// 添加目标用户名称到返回结构中
				feedback.TargetName = target.Username
			}
		}
	}

	return feedbacks, nil
}

// GetAll 获取所有反馈
func (s *feedbackService) GetAll() ([]*models.Feedback, error) {
	// 获取所有反馈
	feedbacks, err := s.feedbackRepo.FindAll()
	if err != nil {
		return nil, err
	}

	// 为每个反馈添加创建者和目标用户的名称
	for _, feedback := range feedbacks {
		// 获取创建者信息
		if feedback.CreatorType == consts.User || feedback.CreatorType == consts.Merchant || feedback.CreatorType == consts.Admin {
			creator, err := s.userRepo.GetByID(feedback.CreatorID)
			if err == nil && creator != nil {
				// 添加创建者名称到返回结构中
				feedback.CreatorName = creator.Username
			}
		}

		// 获取目标用户信息
		if feedback.TargetType == consts.Merchant || feedback.TargetType == consts.Admin {
			target, err := s.userRepo.GetByID(feedback.TargetID)
			if err == nil && target != nil {
				// 添加目标用户名称到返回结构中
				feedback.TargetName = target.Username
			}
		}
	}

	return feedbacks, nil
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
		// 获取用户名
		var userName string
		user, err := s.userRepo.GetByID(userID)
		if err == nil && user != nil {
			userName = user.Username
		}

		// 创建状态变更消息
		message := models.WSMessage{
			Event:     consts.EventStatusChange,
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   userID,
				Type: userType,
				Name: userName,
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

// Delete 删除反馈（级联删除相关消息）
func (s *feedbackService) Delete(id uint64, userID uint64, userType uint8) error {
	// 首先删除该反馈的所有消息
	err := s.messageRepo.DeleteByFeedbackID(id)
	if err != nil {
		return fmt.Errorf("删除反馈消息失败: %v", err)
	}

	// 然后删除反馈本身
	err = s.feedbackRepo.Delete(id)
	if err != nil {
		return fmt.Errorf("删除反馈失败: %v", err)
	}

	// 如果有WebSocket处理程序，发送删除通知
	if s.wsHandler != nil {
		fmt.Printf("=== 发送反馈删除通知 ===\n")
		fmt.Printf("反馈ID: %d, 操作者: %d (类型: %d)\n", id, userID, userType)

		// 获取用户名
		var userName string
		user, err := s.userRepo.GetByID(userID)
		if err == nil && user != nil {
			userName = user.Username
		}

		// 创建反馈删除消息
		message := models.WSMessage{
			Event:     consts.EventFeedbackDelete,
			Timestamp: time.Now(),
			Sender: &models.Sender{
				ID:   userID,
				Type: userType,
				Name: userName,
			},
			Data: &models.FeedbackDeleteData{
				FeedbackID: id,
			},
		}

		// 序列化消息
		jsonMessage, err := json.Marshal(message)
		if err != nil {
			return fmt.Errorf("序列化删除通知失败: %v", err)
		}

		fmt.Printf("发送的WebSocket消息: %s\n", string(jsonMessage))

		// 广播反馈删除消息
		s.wsHandler.BroadcastMessage(jsonMessage)
		fmt.Printf("反馈删除通知已广播\n")
	}

	return nil
}
