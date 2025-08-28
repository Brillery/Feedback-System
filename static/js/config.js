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
    API_BASE_URL: 'http://localhost:8080/api',

    /**
     * WebSocket连接URL
     * 开发环境：ws://localhost:8080/api/ws
     * 生产环境：wss://your-domain.com/api/ws
     */
    WS_URL: 'ws://localhost:8080/api/ws',

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
         */
        USER: {
            REGISTER: '/user/register',
            LOGIN: '/user/login',
            LOGOUT: '/user/logout',
            CURRENT: '/user/me',
            VALIDATE_TOKEN: '/user/me'
        },

        /**
         * 反馈相关API
         * 包括创建、查询、更新、删除反馈等
         */
        FEEDBACK: {
            CREATE: '/feedback',
            GET_ALL: '/feedback',
            GET_BY_ID: '/feedback/', // 需要拼接ID
            GET_BY_CREATOR: '/feedback/creator',
            GET_BY_TARGET: '/feedback/target',
            UPDATE_STATUS: '/feedback/', // 需要拼接ID和/status
            DELETE: '/feedback/' // 需要拼接ID
        },

        /**
         * 反馈消息相关API
         * 包括发送消息、获取消息、标记已读等
         */
        FEEDBACK_MESSAGE: {
            CREATE: '/message',
            GET_BY_FEEDBACK_ID: '/message/feedback/', // 需要拼接反馈ID
            MARK_AS_READ: '/message/', // 需要拼接消息ID和/read
            DELETE: '/message/' // 需要拼接消息ID
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