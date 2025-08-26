package middleware

import (
	"feedback-system/internal/handler"
	"feedback-system/internal/models"
	"feedback-system/internal/service"
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
			handler.Unauthorized(c, "未提供认证令牌")
			return
		}

		tokenString := parts[1]

		// 验证令牌
		user, err := userService.ValidateToken(tokenString)
		if err != nil {
			handler.Unauthorized(c, "未提供认证令牌")
			return
		}

		// 将用户信息存储在上下文中
		c.Set("user", user)
		c.Next()
	}
}

// RoleMiddleware 角色授权中间件
func RoleMiddleware(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文中获取用户信息
		user, exists := c.Get("user")
		if !exists {
			handler.Unauthorized(c, "未提供认证令牌")
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
			if userObj.UserType == role {
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
