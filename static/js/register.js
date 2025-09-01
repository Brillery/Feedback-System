/**
 * 用户注册页面逻辑
 */
class RegisterApp {
    constructor() {
        this.elements = {
            registerForm: document.getElementById('registerForm'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            confirmPassword: document.getElementById('confirmPassword'),
            contact: document.getElementById('contact'),
            userType: document.getElementById('userType'),
            loginLink: document.getElementById('loginLink'),
            alertContainer: document.getElementById('alertContainer')
        };

        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.bindEvents();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 注册表单提交
        this.elements.registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // 登录链接点击
        this.elements.loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.redirectToLogin();
        });
    }

    /**
     * 处理用户注册
     */
    async handleRegister() {
        const username = this.elements.username.value.trim();
        const password = this.elements.password.value.trim();
        const confirmPassword = this.elements.confirmPassword.value.trim();
        const contact = this.elements.contact.value.trim();
        const userType = parseInt(this.elements.userType.value);

        // 表单验证
        if (!username || !password || !confirmPassword || !userType) {
            this.showAlert('请填写所有必填字段', 'warning');
            return;
        }

        if (password !== confirmPassword) {
            this.showAlert('两次输入的密码不一致', 'warning');
            return;
        }

        if (password.length < 6) {
            this.showAlert('密码长度至少6位', 'warning');
            return;
        }

        if (username.length < 3) {
            this.showAlert('用户名长度至少3位', 'warning');
            return;
        }

        try {
            // 构建注册请求数据
            const registerData = {
                username: username,
                password: password,
                contact: contact,
                user_type: userType
            };

            // 发送注册请求
            const response = await HttpUtils.post(CONFIG.ENDPOINTS.USER.REGISTER, registerData);

            this.showAlert('注册成功！正在跳转到登录页面...', 'success');

            // 延迟跳转到登录页面
            setTimeout(() => {
                this.redirectToLogin();
            }, 2000);

        } catch (error) {
            console.error('注册失败:', error);
            this.showAlert('注册失败: ' + error.message, 'danger');
        }
    }

    /**
     * 跳转到登录页面
     */
    redirectToLogin() {
        const userType = parseInt(this.elements.userType.value);

        // 根据用户类型跳转到对应的登录页面
        switch (userType) {
            case CONFIG.USER_TYPE_NUMBERS.USER:
                window.location.href = '/';
                break;
            case CONFIG.USER_TYPE_NUMBERS.MERCHANT:
                window.location.href = '/merchant';
                break;
            default:
                window.location.href = '/';
        }
    }

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 (success, danger, warning, info)
     */
    showAlert(message, type = 'info') {
        const alertId = 'alert-' + Date.now();
        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;

        this.elements.alertContainer.insertAdjacentHTML('beforeend', alertHtml);

        // 自动隐藏提示
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                const bsAlert = new bootstrap.Alert(alertElement);
                bsAlert.close();
            }
        }, CONFIG.UI.ALERT.AUTO_HIDE_DELAY);
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new RegisterApp();
});
