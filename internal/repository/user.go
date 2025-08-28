package repository

import (
	"errors"
	"feedback-system/internal/models"

	"gorm.io/gorm"
)

// UserRepository 用户仓库接口
type UserRepository interface {
	Create(user *models.User) error
	GetByID(id uint64) (*models.User, error)
	GetByUsername(username string, userType uint8) (*models.User, error)
	Update(user *models.User) error
	Delete(id uint64) error
	List() ([]*models.User, error)
}

// userRepository 用户仓库实现
type userRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓库实例
func NewUserRepository(db *gorm.DB) UserRepository {
	repo := &userRepository{db: db}

	// 初始化默认用户
	repo.initDefaultUsers()

	return repo
}

// initDefaultUsers 初始化默认用户
func (r *userRepository) initDefaultUsers() {
	// 检查是否已有用户，如果没有则创建默认用户
	var count int64
	r.db.Model(&models.User{}).Count(&count)

	if count == 0 {
		// 添加默认管理员用户
		adminUser := &models.User{
			ID:       1,
			Username: "admin",
			Password: "admin123", // 实际项目中应该使用加密密码
			UserType: 3,          // 管理员
		}
		r.db.Create(adminUser)

		// 添加默认商家用户
		merchantUser := &models.User{
			ID:       2,
			Username: "merchant",
			Password: "merchant123", // 实际项目中应该使用加密密码
			UserType: 2,             // 商家
		}
		r.db.Create(merchantUser)

		// 添加默认普通用户
		regularUser := &models.User{
			ID:       3,
			Username: "user",
			Password: "user123", // 实际项目中应该使用加密密码
			UserType: 1,         // 普通用户
		}
		r.db.Create(regularUser)
	}
}

// Create 创建用户
func (r *userRepository) Create(user *models.User) error {
	// 检查用户名是否已存在
	var existingUser models.User
	result := r.db.Where("username = ? AND user_type = ?", user.Username, user.UserType).First(&existingUser)
	if result.Error == nil {
		return errors.New("username already exists for this user type")
	}

	// 创建用户
	return r.db.Create(user).Error
}

// GetByID 根据ID获取用户
func (r *userRepository) GetByID(id uint64) (*models.User, error) {
	var user models.User
	result := r.db.First(&user, id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, result.Error
	}
	return &user, nil
}

// GetByUsername 根据用户名和用户类型获取用户
func (r *userRepository) GetByUsername(username string, userType uint8) (*models.User, error) {
	var user models.User
	result := r.db.Where("username = ? AND user_type = ?", username, userType).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, result.Error
	}
	return &user, nil
}

// Update 更新用户
func (r *userRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

// Delete 删除用户
func (r *userRepository) Delete(id uint64) error {
	return r.db.Delete(&models.User{}, id).Error
}

// List 获取所有用户
func (r *userRepository) List() ([]*models.User, error) {
	var users []*models.User
	result := r.db.Find(&users)
	return users, result.Error
}
