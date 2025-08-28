package consts

// WebSocket消息类型常量
const (
	// 消息类型
	TextMessage   = 1 // 文本消息
	ImageMessage  = 2 // 图片消息
	ImagesMessage = 3 // 多图片消息

	// WebSocket事件类型
	EventConnect        = "connect"         // 连接事件
	EventDisconnect     = "disconnect"      // 断开连接事件
	EventMessage        = "message"         // 消息事件
	EventTyping         = "typing"          // 正在输入事件
	EventRead           = "read"            // 已读事件
	EventStatusChange   = "status_change"   // 状态变更事件
	EventFeedbackDelete = "feedback_delete" // 反馈删除事件
)
