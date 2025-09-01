package service

import (
	"crypto/md5"
	"encoding/hex"
	"errors"
	"feedback-system/internal/models"
	"feedback-system/internal/repository"
	"time"

	"github.com/dgrijalva/jwt-go"
)

// 定义JWT密钥，实际项目中应该从配置文件或环境变量中获取
const jwtSecret = "feedback-system-secret-key"

// UserService 用户服务接口
type UserService interface {
	Register(req *models.UserRegisterRequest) (*models.User, error)
	Login(req *models.UserLoginRequest) (*models.UserLoginResponse, error)
	GetUserByID(id uint64) (*models.User, error)
	ValidateToken(token string) (*models.User, error)
	GetMerchants() ([]*models.User, error)
}

// userService 用户服务实现
type userService struct {
	userRepo repository.UserRepository
}

// NewUserService 创建用户服务实例
func NewUserService(userRepo repository.UserRepository) UserService {
	return &userService{
		userRepo: userRepo,
	}
}

// Register 用户注册
func (s *userService) Register(req *models.UserRegisterRequest) (*models.User, error) {
	// 检查用户名是否已存在
	_, err := s.userRepo.GetByUsername(req.Username, req.UserType)
	if err == nil {
		return nil, errors.New("username already exists for this user type")
	}

	// 创建新用户
	user := &models.User{
		Username: req.Username,
		Password: hashPassword(req.Password), // 对密码进行加密
		Contact:  req.Contact,
		UserType: req.UserType,
	}

	// 保存用户
	err = s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

	return user, nil
}

// Login 用户登录
func (s *userService) Login(req *models.UserLoginRequest) (*models.UserLoginResponse, error) {
	// 根据用户名和用户类型查找用户
	user, err := s.userRepo.GetByUsername(req.Username, req.UserType)
	if err != nil {
		return nil, errors.New("invalid username or password")
	}

	// 验证密码
	if user.Password != hashPassword(req.Password) { // 比较加密后的密码
		return nil, errors.New("invalid username or password")
	}

	// 生成JWT令牌
	token, err := generateToken(user)
	if err != nil {
		return nil, err
	}

	// 创建登录响应
	response := &models.UserLoginResponse{
		User:  *user,
		Token: token,
	}

	return response, nil
}

// GetUserByID 根据ID获取用户
func (s *userService) GetUserByID(id uint64) (*models.User, error) {
	return s.userRepo.GetByID(id)
}

// ValidateToken 验证JWT令牌
func (s *userService) ValidateToken(tokenString string) (*models.User, error) {
	// 解析JWT令牌
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	// 验证令牌有效性
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		// 获取用户ID
		userIDFloat, ok := claims["id"].(float64)
		if !ok {
			return nil, errors.New("invalid token claims")
		}
		userID := uint64(userIDFloat)

		// 获取用户信息
		user, err := s.userRepo.GetByID(userID)
		if err != nil {
			return nil, err
		}

		return user, nil
	}

	return nil, errors.New("invalid token")
}

// generateToken 生成JWT令牌
func generateToken(user *models.User) (string, error) {
	// 创建JWT声明
	claims := jwt.MapClaims{
		"id":        user.ID,
		"username":  user.Username,
		"user_type": user.UserType,
		"exp":       time.Now().Add(time.Hour * 24).Unix(), // 令牌有效期为24小时
	}

	// 创建令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 签名令牌
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GetMerchants 获取所有商家用户
func (s *userService) GetMerchants() ([]*models.User, error) {
	return s.userRepo.GetMerchants()
}

// hashPassword 对密码进行MD5加密
func hashPassword(password string) string {
	hash := md5.Sum([]byte(password))
	return hex.EncodeToString(hash[:])
}
