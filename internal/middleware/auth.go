package middleware

import (
	"feedback-system/internal/handler"
	"feedback-system/internal/models"
	"feedback-system/internal/service"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware 认证中间件
func AuthMiddleware(userService service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头中获取Authorization
		authorization := c.GetHeader("Authorization")
		if authorization == "" {
			handler.Unauthorized(c, "未提供认证令牌")
			return
		}

		// 解析Bearer令牌
		parts := strings.Split(authorization, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			handler.Unauthorized(c, "无效的认证令牌格式")
			return
		}

		tokenString := parts[1]

		// 验证令牌
		user, err := userService.ValidateToken(tokenString)
		if err != nil {
			handler.Unauthorized(c, "认证令牌无效或已过期")
			return
		}

		// 将用户信息存储在上下文中
		c.Set("user", user)

		// 设置用户ID和类型到请求头中，供后续处理程序使用
		c.Request.Header.Set("X-User-ID", strconv.FormatUint(user.ID, 10))
		c.Request.Header.Set("X-User-Type", strconv.FormatUint(uint64(user.UserType), 10))

		c.Next()
	}
}

// RoleMiddleware 角色授权中间件
func RoleMiddleware(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文中获取用户信息
		user, exists := c.Get("user")
		if !exists {
			handler.Unauthorized(c, "未认证")
			return
		}

		// 检查用户角色
		userObj, ok := user.(*models.User)
		if !ok {
			handler.ServerError(c, "用户类型断言失败")
			return
		}

		hasRole := false
		for _, role := range roles {
			var roleType uint8
			switch role {
			case "user":
				roleType = 1
			case "merchant":
				roleType = 2
			case "admin":
				roleType = 3
			default:
				continue
			}

			if userObj.UserType == roleType {
				hasRole = true
				break
			}
		}

		if !hasRole {
			handler.Forbidden(c, "没有权限访问此资源")
			return
		}

		c.Next()
	}
}
