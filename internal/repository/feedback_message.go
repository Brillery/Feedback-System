package repository

import (
	"feedback-system/internal/models"

	"gorm.io/gorm"
)

type FeedbackMessageRepository interface {
	Create(msg *models.FeedbackMessage) error
	FindAllByFeedbackID(fId uint64) ([]*models.FeedbackMessage, error)
	MarkAsRead(id uint64)
	Delete(id uint64) error
	DeleteByFeedbackID(feedbackId uint64) error
}

type feedbackMessageRepository struct {
	db *gorm.DB
}

func NewFeedbackMessageRepository(db *gorm.DB) FeedbackMessageRepository {
	return &feedbackMessageRepository{db: db}
}

func (r *feedbackMessageRepository) Create(msg *models.FeedbackMessage) error {
	return r.db.Create(msg).Error
}

// 为啥 更新和删除要.Model?
// 因为
// Create()：传入的是具体的对象实例 msg，GORM 可以从中推断出模型类型
// Find()：传入的是目标变量 &rs，GORM 可以推断模型类型
// 而更新和删除都只传递了一个id，无法推断模型，
// 从而手动需要指定操作哪个表

func (r *feedbackMessageRepository) FindAllByFeedbackID(fId uint64) (rs []*models.FeedbackMessage, err error) {
	return rs, r.db.Where("feedback_id = ?", fId).Find(&rs).Error
}

func (r *feedbackMessageRepository) MarkAsRead(id uint64) {
	r.db.Model(&models.FeedbackMessage{}).Where("id = ?", id).Update("is_read", true)
}

func (r *feedbackMessageRepository) Delete(id uint64) error {
	return r.db.Delete(&models.FeedbackMessage{}, id).Error
}

func (r *feedbackMessageRepository) DeleteByFeedbackID(feedbackId uint64) error {
	return r.db.Where("feedback_id = ?", feedbackId).Delete(&models.FeedbackMessage{}).Error
}
