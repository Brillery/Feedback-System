package db

import (
	"feedback-system/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func NewDB(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&models.User{},
		&models.Feedback{},
		&models.FeedbackMessage{},
	)

	return db, err
}
