/**
 * 反馈系统 - 全局配置文件
 * 
 * 本文件包含系统的所有配置信息，包括：
 * - API端点配置
 * - WebSocket配置
 * - 业务常量定义
 * - 用户类型和状态定义
 * 
 * @author Feedback System Team
 * @version 1.0.0
 */

const CONFIG = {
    // ==================== 基础配置 ====================

    /**
     * API基础URL
     * 开发环境：http://localhost:8080/api
     * 生产环境：https://your-domain.com/api
     */
    API_BASE_URL: (() => {
        // 自动检测当前页面的端口，用于API请求
        const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        return `${window.location.protocol}//${window.location.hostname}:${currentPort}/api`;
    })(),

    /**
     * WebSocket连接URL
     * 开发环境：ws://localhost:8080/api/ws
     * 生产环境：wss://your-domain.com/api/ws
     * 
     * 前后端对接说明：
     * - 后端处理器：pkg/ws/handler.go 中的 WSHandler.HandleConnection() 方法
     * - 路由注册：cmd/main.go 第71行 wsHttpHandler.RegisterRoutes(apiGroup)
     * - 连接参数：需要传递 user_id, user_type, user_name, token 查询参数
     * - 实时通信：用于反馈状态变更、新消息、删除事件等实时推送
     */
    WS_URL: (() => {
        // 自动检测当前页面的端口，用于WebSocket连接
        const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProtocol}//${window.location.hostname}:${currentPort}/api/ws`;
    })(),

    /**
     * 请求超时时间（毫秒）
     */
    REQUEST_TIMEOUT: 10000,

    /**
     * WebSocket重连间隔（毫秒）
     */
    WS_RECONNECT_INTERVAL: 3000,

    // ==================== API端点配置 ====================

    ENDPOINTS: {
        /**
         * 用户相关API
         * 包括登录、注册、获取用户信息等
         * 
         * 前后端对接说明：
         * - 前端调用这些端点时，会通过 HttpUtils.post() 或 HttpUtils.get() 发送请求
         * - 后端对应处理器：internal/handler/user.go 中的 UserHandler
         * - 路由注册：cmd/main.go 第70行 userHandler.RegisterRoutes(apiGroup)
         */
        USER: {
            REGISTER: '/user/register',        // → handler/user.go Register() 方法
            LOGIN: '/user/login',              // → handler/user.go Login() 方法
            LOGOUT: '/user/logout',            // 前端本地清理，无后端接口
            CURRENT: '/user/me',               // → handler/user.go GetCurrentUser() 方法
            VALIDATE_TOKEN: '/user/me',        // 同上，用于验证token有效性
            MERCHANTS: '/user/merchants',      // → handler/user.go GetMerchants() 方法
            GET_BY_ID: '/user/info'            // → handler/user.go GetUserInfo() 方法
        },

        /**
         * 反馈相关API
         * 包括创建、查询、更新、删除反馈等
         * 
         * 前后端对接说明：
         * - 后端处理器：internal/handler/feedback.go 中的 FeedbackHandler
         * - 路由注册：cmd/main.go 第78行 feedbackHandler.RegisterRoutes(authApi)
         * - 需要认证：所有反馈接口都需要通过 middleware.AuthMiddleware 认证
         */
        FEEDBACK: {
            CREATE: '/feedback',                    // → handler/feedback.go Create() 方法
            GET_ALL: '/feedback',                   // → handler/feedback.go GetAll() 方法
            GET_BY_ID: '/feedback/',                // → handler/feedback.go GetByID() 方法 (需要拼接ID)
            GET_BY_CREATOR: '/feedback/creator',    // → handler/feedback.go GetByCreator() 方法
            GET_BY_TARGET: '/feedback/target',      // → handler/feedback.go GetByTarget() 方法
            UPDATE_STATUS: '/feedback/',            // → handler/feedback.go UpdateStatus() 方法 (需要拼接ID和/status)
            DELETE: '/feedback/'                    // → handler/feedback.go Delete() 方法 (需要拼接ID)
        },

        /**
         * 反馈消息相关API
         * 包括发送消息、获取消息、标记已读等
         * 
         * 前后端对接说明：
         * - 后端处理器：internal/handler/feedback_message.go 中的 FeedbackMessageHandler
         * - 路由注册：cmd/main.go 第79行 messageHandler.RegisterRoutes(authApi)
         * - 需要认证：所有消息接口都需要通过 middleware.AuthMiddleware 认证
         * - WebSocket集成：创建消息后会通过WebSocket实时推送给相关用户
         */
        FEEDBACK_MESSAGE: {
            CREATE: '/message',                        // → handler/feedback_message.go Create() 方法
            GET_BY_FEEDBACK_ID: '/message/feedback/',  // → handler/feedback_message.go GetByFeedbackID() 方法 (需要拼接反馈ID)
            MARK_AS_READ: '/message/',                 // → handler/feedback_message.go MarkAsRead() 方法 (需要拼接消息ID和/read)
            DELETE: '/message/'                        // → handler/feedback_message.go Delete() 方法 (需要拼接消息ID)
        },

        /**
         * 文件上传相关API
         * 包括图片上传等
         * 
         * 前后端对接说明：
         * - 后端处理器：internal/handler/upload.go 中的 UploadHandler
         * - 路由注册：cmd/main.go 第82行 authApi.POST("/upload/image", uploadHandler.UploadImage)
         * - 需要认证：需要通过 middleware.AuthMiddleware 认证
         * - 文件限制：仅支持图片文件，最大5MB
         * - 存储路径：文件保存在 ./static/uploads/ 目录下
         */
        UPLOAD: {
            IMAGE: '/upload/image'                     // → handler/upload.go UploadImage() 方法
        }
    },

    // ==================== 业务常量定义 ====================

    /**
     * 反馈状态常量
     * 对应后端 consts/status.go 中的定义
     */
    FEEDBACK_STATUS: {
        OPEN: 1,           // 待处理
        IN_PROGRESS: 2,    // 处理中
        RESOLVED: 3        // 已解决
    },

    /**
     * 用户类型常量
     * 对应后端 consts/user_type.go 中的定义
     */
    USER_TYPE: {
        USER: 'user',      // 普通用户
        MERCHANT: 'merchant', // 商家
        ADMIN: 'admin'     // 管理员
    },

    /**
     * 用户类型数字映射
     * 用于与后端API交互时的类型转换
     */
    USER_TYPE_NUMBERS: {
        USER: 1,
        MERCHANT: 2,
        ADMIN: 3
    },

    /**
     * 目标类型常量
     * 用于反馈的目标对象类型
     */
    TARGET_TYPE: {
        MERCHANT: 1,  // 商家
        ADMIN: 2      // 管理员
    },

    /**
     * 消息类型常量
     */
    MESSAGE_TYPE: {
        SYSTEM: 0,    // 系统消息
        TEXT: 1,      // 文本消息
        IMAGE: 2,     // 图片消息
        IMAGE_ARRAY: 3 // 多图片消息
    },

    /**
     * 已读状态常量
     */
    READ_STATUS: {
        UNREAD: 0,    // 未读
        READ: 1       // 已读
    },

    // ==================== WebSocket事件类型 ====================

    /**
     * WebSocket事件类型
     * 用于实时通信的事件定义
     */
    WS_EVENT_TYPE: {
        CONNECT: 'connect',           // 连接事件
        DISCONNECT: 'disconnect',     // 断开连接事件
        MESSAGE: 'message',           // 消息事件
        TYPING: 'typing',             // 正在输入事件
        READ: 'read',                 // 已读事件
        STATUS_CHANGE: 'status_change', // 状态变更事件
        FEEDBACK_DELETE: 'feedback_delete', // 反馈删除事件
        NEW_FEEDBACK: 'new_feedback'  // 新反馈事件
    },

    // ==================== 本地存储键名 ====================

    /**
     * 本地存储键名常量
     * 用于统一管理localStorage的键名
     */
    STORAGE_KEYS: {
        USER_TOKEN: 'user_token',
        USER_DATA: 'user_data',
        USER_TYPE: 'user_type',
        MERCHANT_TOKEN: 'merchant_token',
        MERCHANT_DATA: 'merchant_data',
        ADMIN_TOKEN: 'admin_token',
        ADMIN_DATA: 'admin_data'
    },

    // ==================== UI配置 ====================

    /**
     * UI相关配置
     */
    UI: {
        /**
         * 消息显示配置
         */
        MESSAGE: {
            MAX_LENGTH: 1000,         // 消息最大长度
            TYPING_TIMEOUT: 3000,     // 正在输入超时时间
            AUTO_SCROLL_DELAY: 100    // 自动滚动延迟
        },

        /**
         * 提示信息配置
         */
        ALERT: {
            AUTO_HIDE_DELAY: 3000,    // 自动隐藏延迟
            POSITION: 'top-center'    // 显示位置
        },

        /**
         * 分页配置
         */
        PAGINATION: {
            DEFAULT_PAGE_SIZE: 20,    // 默认每页数量
            MAX_PAGE_SIZE: 100        // 最大每页数量
        }
    },

    // ==================== 错误码定义 ====================

    /**
     * 错误码常量
     * 对应后端响应中的code字段
     */
    ERROR_CODES: {
        SUCCESS: 200,             // 成功
        BAD_REQUEST: 400,         // 请求参数错误
        UNAUTHORIZED: 401,        // 未授权
        FORBIDDEN: 403,           // 禁止访问
        NOT_FOUND: 404,           // 资源不存在
        INTERNAL_ERROR: 500       // 服务器内部错误
    }
};

/**
 * 环境检测函数
 * 用于检测当前运行环境
 */
CONFIG.isDevelopment = function () {
    return window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
};

/**
 * 环境检测函数
 * 用于检测当前运行环境
 */
CONFIG.isProduction = function () {
    return !this.isDevelopment();
};

/**
 * 获取API基础URL
 * 根据环境返回不同的URL
 */
CONFIG.getApiBaseUrl = function () {
    if (this.isDevelopment()) {
        return 'http://localhost:8080/api';
    }
    return 'https://your-domain.com/api'; // 生产环境URL
};

/**
 * 获取WebSocket URL
 * 根据环境返回不同的URL
 */
CONFIG.getWsUrl = function () {
    if (this.isDevelopment()) {
        return 'ws://localhost:8080/api/ws';
    }
    return 'wss://your-domain.com/api/ws'; // 生产环境URL
};

// 根据环境动态设置URL
CONFIG.API_BASE_URL = CONFIG.getApiBaseUrl();
CONFIG.WS_URL = CONFIG.getWsUrl();

// 防止配置被意外修改
Object.freeze(CONFIG);

// 导出配置（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}