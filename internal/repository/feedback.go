package repository

import (
	"feedback-system/internal/models"
	"gorm.io/gorm"
)

type FeedbackRepository interface {
	Create(feedback *models.Feedback) error
	FindByID(id uint64) (*models.Feedback, error)
	FindByCreator(creatorID uint64, creatorType uint8) ([]*models.Feedback, error)
	FindByTarget(targetID uint64, targetType uint8) ([]*models.Feedback, error)
	FindAll() ([]*models.Feedback, error)
	UpdateStatus(id uint64, status uint8) error
	Delete(id uint64) error
}

type feedbackRepository struct {
	db *gorm.DB
}

func NewFeedbackRepository(db *gorm.DB) FeedbackRepository {
	return &feedbackRepository{db: db}
}

func (r *feedbackRepository) Create(feedback *models.Feedback) error {
	return r.db.Create(feedback).Error
}

func (r *feedbackRepository) FindByID(id uint64) (feedback *models.Feedback, err error) {
	err = r.db.First(feedback, id).Error
	if err != nil {
		return nil, err
	}
	return feedback, err
}

func (r *feedbackRepository) FindByCreator(cId uint64, cType uint8) (feedbacks []*models.Feedback, err error) {
	err = r.db.Find(&feedbacks, "creator_id = ? and cType = ?", cId, cType).Error
	if err != nil {
		return nil, err
	}
	return
}

func (r *feedbackRepository) FindByTarget(tId uint64, tType uint8) (feedbacks []*models.Feedback, err error) {
	err = r.db.Find(&feedbacks, "target_id = ? and cType = ?", tId, tType).Error
	if err != nil {
		return nil, err
	}
	return
}

func (r *feedbackRepository) FindAll() (feedbacks []*models.Feedback, err error) {
	err = r.db.Find(&feedbacks).Error
	if err != nil {
		return nil, err
	}
	return
}

func (r *feedbackRepository) UpdateStatus(id uint64, status uint8) (err error) {
	return r.db.Model(&models.Feedback{}).Where("id = ?", id).Update("status", status).Error
}

func (r *feedbackRepository) Delete(id uint64) (err error) {
	return r.db.Delete(&models.Feedback{}, id).Error
}
