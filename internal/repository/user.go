package repository

import (
	"errors"
	"feedback-system/internal/models"
	"sync"
	"time"

	"github.com/google/uuid"
)

// UserRepository 用户仓库接口
type UserRepository interface {
	Create(user *models.User) error
	GetByID(id string) (*models.User, error)
	GetByUsername(username string, userType string) (*models.User, error)
	Update(user *models.User) error
	Delete(id string) error
	List() ([]*models.User, error)
}

// userRepository 用户仓库实现
type userRepository struct {
	users map[string]*models.User
	mutex sync.RWMutex
}

// NewUserRepository 创建用户仓库实例
func NewUserRepository() UserRepository {
	// 初始化一些默认用户
	users := make(map[string]*models.User)

	// 添加默认管理员用户
	adminID := uuid.New().String()
	adminUser := &models.User{
		ID:        adminID,
		Username:  "admin",
		Password:  "admin123", // 实际项目中应该使用加密密码
		UserType:  "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	users[adminID] = adminUser

	// 添加默认商家用户
	merchantID := uuid.New().String()
	merchantUser := &models.User{
		ID:        merchantID,
		Username:  "merchant",
		Password:  "merchant123", // 实际项目中应该使用加密密码
		UserType:  "merchant",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	users[merchantID] = merchantUser

	// 添加默认普通用户
	userID := uuid.New().String()
	regularUser := &models.User{
		ID:        userID,
		Username:  "user",
		Password:  "user123", // 实际项目中应该使用加密密码
		UserType:  "user",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	users[userID] = regularUser

	return &userRepository{
		users: users,
		mutex: sync.RWMutex{},
	}
}

// Create 创建用户
func (r *userRepository) Create(user *models.User) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	// 检查用户名是否已存在
	for _, existingUser := range r.users {
		if existingUser.Username == user.Username && existingUser.UserType == user.UserType {
			return errors.New("username already exists for this user type")
		}
	}

	// 设置ID和时间
	if user.ID == "" {
		user.ID = uuid.New().String()
	}
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	// 保存用户
	r.users[user.ID] = user
	return nil
}

// GetByID 根据ID获取用户
func (r *userRepository) GetByID(id string) (*models.User, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	user, exists := r.users[id]
	if !exists {
		return nil, errors.New("user not found")
	}
	return user, nil
}

// GetByUsername 根据用户名和用户类型获取用户
func (r *userRepository) GetByUsername(username string, userType string) (*models.User, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	for _, user := range r.users {
		if user.Username == username && user.UserType == userType {
			return user, nil
		}
	}
	return nil, errors.New("user not found")
}

// Update 更新用户
func (r *userRepository) Update(user *models.User) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.users[user.ID]
	if !exists {
		return errors.New("user not found")
	}

	user.UpdatedAt = time.Now()
	r.users[user.ID] = user
	return nil
}

// Delete 删除用户
func (r *userRepository) Delete(id string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	_, exists := r.users[id]
	if !exists {
		return errors.New("user not found")
	}

	delete(r.users, id)
	return nil
}

// List 获取所有用户
func (r *userRepository) List() ([]*models.User, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	users := make([]*models.User, 0, len(r.users))
	for _, user := range r.users {
		users = append(users, user)
	}
	return users, nil
}