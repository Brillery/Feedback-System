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

func (r *feedbackRepository) FindByID(id uint64) (*models.Feedback, error) {
	//var feedback models.Feedback

}
