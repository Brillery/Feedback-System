/**
 * 反馈系统 - 通用工具类
 * @author Feedback System Team
 * @version 1.0.0
 */

/**
 * HTTP请求工具类
 */
class HttpUtils {
    static async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    static async post(url, data = null, options = {}) {
        return this.request(url, { ...options, method: 'POST', body: data });
    }

    static async put(url, data = null, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body: data });
    }

    static async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    static async request(url, options = {}) {
        const fullUrl = url.startsWith('http') ? url : `${CONFIG.API_BASE_URL}${url}`;

        // 根据当前页面自动选择正确的token
        let token = null;
        const currentPath = window.location.pathname;
        if (currentPath.includes('/merchant')) {
            token = localStorage.getItem(CONFIG.STORAGE_KEYS.MERCHANT_TOKEN);
        } else if (currentPath.includes('/admin')) {
            token = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_TOKEN);
        } else {
            token = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TOKEN);
        }

        const requestHeaders = {
            ...options.headers
        };

        // 如果body不是FormData，则设置Content-Type为application/json
        if (options.body && !(options.body instanceof FormData)) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
        }

        const requestOptions = {
            method: options.method,
            headers: requestHeaders
        };

        if (options.body && options.method !== 'GET') {
            // 如果是FormData，直接使用；否则JSON序列化
            if (options.body instanceof FormData) {
                requestOptions.body = options.body;
            } else {
                requestOptions.body = JSON.stringify(options.body);
            }
        }

        try {
            const response = await fetch(fullUrl, requestOptions);
            return await this.handleResponse(response);
        } catch (error) {
            console.error('HTTP请求错误:', error);
            throw error;
        }
    }

    static async handleResponse(response) {
        if (!response.ok) {
            if (response.status === 401) {
                StorageUtils.clearUserData();
                window.location.reload();
                throw new Error('登录已过期，请重新登录');
            }
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data.code !== CONFIG.ERROR_CODES.SUCCESS) {
            throw new Error(data.message || '请求失败');
        }

        return data;
    }
}

/**
 * 本地存储工具类
 */
class StorageUtils {
    static setToken(token) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_TOKEN, token);
    }

    static getToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TOKEN);
    }

    static setUserData(userData) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    }

    static getUserData() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
        return data ? JSON.parse(data) : null;
    }

    static setUserType(userType) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USER_TYPE, userType);
    }

    static getUserType() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.USER_TYPE);
    }

    static clearUserData() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_TYPE);
    }

    static isLoggedIn() {
        return !!this.getToken();
    }
}

/**
 * 日期时间工具类
 */
class DateTimeUtils {
    static formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);

        if (isNaN(d.getTime())) {
            return '无效日期';
        }

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    static formatDateTime(date) {
        return this.formatDate(date, 'YYYY-MM-DD HH:mm:ss');
    }

    static formatRelativeTime(date) {
        const now = new Date();
        const target = new Date(date);
        const diff = now - target;

        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;
        const month = 30 * day;
        const year = 365 * day;

        if (diff < minute) {
            return '刚刚';
        } else if (diff < hour) {
            return `${Math.floor(diff / minute)}分钟前`;
        } else if (diff < day) {
            return `${Math.floor(diff / hour)}小时前`;
        } else if (diff < week) {
            return `${Math.floor(diff / day)}天前`;
        } else if (diff < month) {
            return `${Math.floor(diff / week)}周前`;
        } else if (diff < year) {
            return `${Math.floor(diff / month)}个月前`;
        } else {
            return `${Math.floor(diff / year)}年前`;
        }
    }
}

/**
 * 数据验证工具类
 */
class ValidationUtils {
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static isValidPhone(phone) {
        const phoneRegex = /^1[3-9]\d{9}$/;
        return phoneRegex.test(phone);
    }

    static isValidUsername(username) {
        return username.length >= 3 && username.length <= 20;
    }

    static isValidPassword(password) {
        return password.length >= 6;
    }

    static isEmpty(value) {
        return value === null || value === undefined || value === '';
    }
}

// 导出工具类
window.HttpUtils = HttpUtils;
window.StorageUtils = StorageUtils;
window.DateTimeUtils = DateTimeUtils;
window.ValidationUtils = ValidationUtils;
