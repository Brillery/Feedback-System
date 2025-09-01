package repository

import (
	"crypto/md5"
	"encoding/hex"
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
	GetAdmins() ([]*models.User, error)
	GetMerchants() ([]*models.User, error)
}

// userRepository 用户仓库实现
type userRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓库实例
func NewUserRepository(db *gorm.DB) UserRepository {
	repo := &userRepository{db: db}

	// 初始化默认管理员用户（如果不存在）
	repo.initDefaultAdmin()

	return repo
}

// initDefaultAdmin 初始化默认管理员用户
func (r *userRepository) initDefaultAdmin() {
	// 检查是否已有管理员用户
	var count int64
	r.db.Model(&models.User{}).Where("user_type = ?", 3).Count(&count)

	if count == 0 {
		// 添加默认管理员用户
		adminUser := &models.User{
			Username: "admin",
			Password: hashPassword("admin123"), // 使用加密密码
			UserType: 3,                        // 管理员
		}
		r.db.Create(adminUser)
	}
}

// Create 创建用户
func (r *userRepository) Create(user *models.User) error {
	// 检查用户名在同一用户类型下是否已存在
	var existingUser models.User
	result := r.db.Where("username = ? AND user_type = ?", user.Username, user.UserType).First(&existingUser)
	if result.Error == nil {
		return errors.New("username already exists for this user type")
	}
	// 如果是"record not found"错误，说明用户名不存在，可以创建
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
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

// GetAdmins 获取所有管理员用户
func (r *userRepository) GetAdmins() ([]*models.User, error) {
	var admins []*models.User
	result := r.db.Where("user_type = ?", 3).Find(&admins)
	return admins, result.Error
}

// GetMerchants 获取所有商家用户
func (r *userRepository) GetMerchants() ([]*models.User, error) {
	var merchants []*models.User
	result := r.db.Where("user_type = ?", 2).Find(&merchants)
	return merchants, result.Error
}

// hashPassword 对密码进行MD5加密
func hashPassword(password string) string {
	hash := md5.Sum([]byte(password))
	return hex.EncodeToString(hash[:])
}
