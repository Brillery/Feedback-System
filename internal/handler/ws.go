package handler

import (
	"feedback-system/pkg/ws"
	"github.com/gin-gonic/gin"
)

// WSHandler WebSocket处理程序
type WSHandler struct {
	wsHandler *ws.WSHandler
}

// NewWSHandler 创建WebSocket处理程序
func NewWSHandler(wsHandler *ws.WSHandler) *WSHandler {
	return &WSHandler{
		wsHandler: wsHandler,
	}
}

// HandleConnection 处理WebSocket连接
func (h *WSHandler) HandleConnection(c *gin.Context) {
	h.wsHandler.HandleConnection(c)
}

// RegisterRoutes 注册路由
func (h *WSHandler) RegisterRoutes(router *gin.RouterGroup) {
	router.GET("/ws", h.HandleConnection) // WebSocket连接
}