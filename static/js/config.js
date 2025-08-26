/**
 * 反馈系统配置文件
 * 包含API端点和WebSocket连接信息
 */

const CONFIG = {
    // API基础URL
    API_BASE_URL: 'http://localhost:8080/api',
    
    // WebSocket连接URL
    WS_URL: 'ws://localhost:8080/ws',
    
    // API端点
    ENDPOINTS: {
        // 反馈相关
        FEEDBACK: {
            CREATE: '/feedback',
            GET_ALL: '/feedback',
            GET_BY_ID: '/feedback/', // 需要拼接ID
            UPDATE_STATUS: '/feedback/status/', // 需要拼接ID
            DELETE: '/feedback/' // 需要拼接ID
        },
        
        // 反馈消息相关
        FEEDBACK_MESSAGE: {
            CREATE: '/feedback-message',
            GET_BY_FEEDBACK_ID: '/feedback-message/feedback/', // 需要拼接反馈ID
            MARK_AS_READ: '/feedback-message/read/', // 需要拼接消息ID
            DELETE: '/feedback-message/' // 需要拼接消息ID
        },
        
        // 用户相关（模拟，实际项目中需要实现）
        USER: {
            REGISTER: '/user/register',
            LOGIN: '/user/login',
            LOGOUT: '/user/logout',
            CURRENT: '/user/me'
        },

        // merchant
        MERCHANT: {
            REGISTER: '/merchant/register',
            LOGIN: '/merchant/login',
            LOGOUT: '/merchant/logout',
            CURRENT: '/merchant/me'
        },

        // admin
        ADMIN: {
            REGISTER: '/admin/register',
            LOGIN: '/admin/login',
            LOGOUT: '/admin/logout',
            CURRENT: '/admin/me'
        }
    },
    
    // 反馈状态
    FEEDBACK_STATUS: {
        OPEN: 'open',
        IN_PROGRESS: 'in_progress',
        RESOLVED: 'resolved',
        CLOSED: 'closed'
    },
    
    // 用户类型
    USER_TYPE: {
        USER: 'user',
        MERCHANT: 'merchant',
        ADMIN: 'admin'
    },
    
    // WebSocket消息类型
    WS_MESSAGE_TYPE: {
        TEXT: 'text',
        IMAGE: 'image'
    },
    
    // WebSocket事件类型
    WS_EVENT_TYPE: {
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        MESSAGE: 'message',
        TYPING: 'typing',
        READ: 'read',
        STATUS_CHANGE: 'status_change'
    }
};