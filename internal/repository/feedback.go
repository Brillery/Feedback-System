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
	// 返回值已经给了命名，效果等同于声明，也就是赋零值
	// 这里只是声明了一个指针变量，值为 nil
	// var feedback *models.Feedback
	// 由于后续first要绑定feedback，
	// 所以这里要提前创建一个 Feedback 实例，并让 feedback 指向它
	//feedback = &models.Feedback{}
	feedback = &models.Feedback{}
	err = r.db.First(feedback, id).Error
	if err != nil {
		return nil, err
	}
	return feedback, nil
}

func (r *feedbackRepository) FindByCreator(cId uint64, cType uint8) (feedbacks []*models.Feedback, err error) {
	err = r.db.Find(&feedbacks, "creator_id = ? and creator_type = ?", cId, cType).Error
	if err != nil {
		return nil, err
	}
	return
}

func (r *feedbackRepository) FindByTarget(tId uint64, tType uint8) (feedbacks []*models.Feedback, err error) {
	err = r.db.Find(&feedbacks, "target_id = ? and target_type = ?", tId, tType).Error
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
	result := r.db.Table("feedbacks").Where("id = ?", id).Update("status", status)
	return result.Error
}

func (r *feedbackRepository) Delete(id uint64) (err error) {
	return r.db.Delete(&models.Feedback{}, id).Error
}
