/**
 * 反馈系统 - 商家端JavaScript
 * 
 * 本文件实现商家端的所有功能，包括：
 * - 商家登录/注册
 * - 查看和处理用户反馈
 * - 回复用户消息
 * - 更新反馈状态
 * - 实时消息通信
 * 
 * @author Feedback System Team
 * @version 1.0.0
 */

/**
 * 商家端应用主类
 * 负责管理商家端的所有功能和状态
 */
class MerchantApp {
    constructor() {
        // 应用状态
        this.state = {
            currentUser: null,
            currentFeedbackId: null,
            feedbacks: [],
            wsConnection: null,
            typingTimeout: null,
            currentFilter: 'all'
        };

        // DOM元素引用
        this.elements = this.initializeElements();

        // 初始化应用
        this.init();
    }

    /**
     * 初始化DOM元素引用
     * @returns {Object} DOM元素对象
     */
    initializeElements() {
        return {
            // 用户信息相关
            username: document.getElementById('username'),
            loginBtn: document.getElementById('loginBtn'),
            logoutBtn: document.getElementById('logoutBtn'),

            // 反馈列表相关
            feedbackList: document.getElementById('feedbackList'),
            filterItems: document.querySelectorAll('.filter-item'),
            newSystemFeedbackBtn: document.getElementById('newSystemFeedbackBtn'),

            // 反馈详情相关
            currentFeedbackTitle: document.getElementById('currentFeedbackTitle'),
            currentFeedbackStatus: document.getElementById('currentFeedbackStatus'),
            statusDropdown: document.getElementById('statusDropdown'),
            statusItems: document.querySelectorAll('.status-item'),

            // 聊天相关
            chatContainer: document.getElementById('chatContainer'),
            noChatSelected: document.getElementById('noChatSelected'),
            messageInputArea: document.getElementById('messageInputArea'),
            messageInput: document.getElementById('messageInput'),
            sendMessageBtn: document.getElementById('sendMessageBtn'),
            imageBtn: document.getElementById('imageBtn'),
            imageInput: document.getElementById('imageInput'),
            imagePreview: document.getElementById('imagePreview'),
            typingIndicator: document.getElementById('typingIndicator'),

            // 模态框相关
            loginModal: null, // 延迟初始化
            loginForm: document.getElementById('loginForm'),
            loginUsername: document.getElementById('loginUsername'),
            loginPassword: document.getElementById('loginPassword'),
            loginSubmitBtn: document.getElementById('loginSubmitBtn'),

            // 系统反馈相关
            systemFeedbackModal: null, // 延迟初始化
            systemFeedbackForm: document.getElementById('systemFeedbackForm'),
            systemFeedbackTitle: document.getElementById('systemFeedbackTitle'),
            systemFeedbackContent: document.getElementById('systemFeedbackContent'),
            systemFeedbackContact: document.getElementById('systemFeedbackContact'),
            submitSystemFeedbackBtn: document.getElementById('submitSystemFeedbackBtn')
        };
    }

    /**
     * 初始化应用
     */
    init() {
        // 清理localStorage中的旧数据（只在第一次加载时执行）
        if (!sessionStorage.getItem('localStorage_cleaned')) {
            StorageUtils.clearAllLocalStorageData();
            sessionStorage.setItem('localStorage_cleaned', 'true');
        }

        // 初始化模态框
        this.initializeModals();

        this.bindEvents();
        this.checkLoginStatus();
    }

    /**
     * 初始化模态框
     */
    initializeModals() {
        // 延迟初始化模态框，确保DOM已加载
        this.elements.loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        this.elements.systemFeedbackModal = new bootstrap.Modal(document.getElementById('systemFeedbackModal'));
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 登录相关事件
        this.elements.loginBtn.addEventListener('click', () => {
            this.elements.loginModal.show();
        });

        this.elements.loginSubmitBtn.addEventListener('click', () => {
            this.handleLogin();
        });

        this.elements.logoutBtn.addEventListener('click', () => {
            this.handleLogout();
        });

        // 系统反馈相关事件
        this.elements.newSystemFeedbackBtn.addEventListener('click', () => {
            if (!this.state.currentUser) {
                this.showAlert('请先登录', 'warning');
                this.elements.loginModal.show();
                return;
            }
            // 自动填充用户的联系方式
            if (this.state.currentUser.contact) {
                this.elements.systemFeedbackContact.value = this.state.currentUser.contact;
            }
            this.elements.systemFeedbackModal.show();
        });

        this.elements.submitSystemFeedbackBtn.addEventListener('click', () => {
            this.handleSubmitSystemFeedback();
        });

        // 消息相关事件
        this.elements.sendMessageBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        this.elements.imageBtn.addEventListener('click', () => {
            this.elements.imageInput.click();
        });

        this.elements.imageInput.addEventListener('change', (e) => {
            this.handleImageSelect(e);
        });

        this.elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.elements.messageInput.addEventListener('input', () => {
            this.handleTyping();
        });

        // 筛选按钮事件
        this.elements.filterItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFilterChange(e.target);
            });
        });

        // 状态更改按钮事件
        this.elements.statusItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleStatusChange(e.target);
            });
        });
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        const savedUser = StorageUtils.getUserData();
        const token = StorageUtils.getToken();

        if (savedUser && token) {
            try {
                this.state.currentUser = JSON.parse(savedUser);

                // 验证令牌有效性
                // 前后端对接：GET /api/user/me → internal/handler/user.go GetCurrentUser()方法
                // 需要Authorization头：Bearer {token}
                // 响应数据：{code, message, data: user对象}
                const response = await HttpUtils.get(CONFIG.ENDPOINTS.USER.CURRENT);

                if (response.code === CONFIG.ERROR_CODES.SUCCESS) {
                    this.updateUIAfterLogin();
                    await this.loadFeedbacks();
                    this.connectWebSocket();
                } else {
                    this.handleLogout();
                }
            } catch (error) {
                console.error('验证令牌失败:', error);
                this.handleLogout();
            }
        }
    }

    /**
     * 处理商家登录
     */
    async handleLogin() {
        const username = this.elements.loginUsername.value.trim();
        const password = this.elements.loginPassword.value.trim();

        // 输入验证
        if (!username || !password) {
            this.showAlert('请输入用户名和密码', 'warning');
            return;
        }

        if (!ValidationUtils.isValidUsername(username)) {
            this.showAlert('用户名长度应在3-20个字符之间', 'warning');
            return;
        }

        if (!ValidationUtils.isValidPassword(password)) {
            this.showAlert('密码长度至少6个字符', 'warning');
            return;
        }

        try {
            // 构建登录请求数据
            const loginData = {
                username: username,
                password: password,
                user_type: CONFIG.USER_TYPE_NUMBERS.MERCHANT
            };

            // 发送登录请求
            // 前后端对接：POST /api/user/login → internal/handler/user.go Login()方法
            // 请求数据：{username, password, user_type: 2} (2=商家)
            // 响应数据：{code, message, data: {user, token}}
            const response = await HttpUtils.post(CONFIG.ENDPOINTS.USER.LOGIN, loginData);

            // 保存用户信息和令牌（使用商家专用存储键）
            this.state.currentUser = {
                ...response.data.user
            };
            StorageUtils.setToken(response.data.token);
            StorageUtils.setUserData(response.data.user);
            StorageUtils.setUserType(CONFIG.USER_TYPE.MERCHANT);

            // 更新UI
            this.updateUIAfterLogin();

            // 关闭登录模态框
            this.elements.loginModal.hide();

            // 重置表单
            this.elements.loginForm.reset();

            // 加载反馈列表
            await this.loadFeedbacks();

            // 连接WebSocket
            this.connectWebSocket();

            this.showAlert('登录成功', 'success');
        } catch (error) {
            console.error('登录失败:', error);
            this.showAlert('登录失败: ' + error.message, 'danger');
        }
    }

    /**
     * 处理商家登出
     */
    handleLogout() {
        // 关闭WebSocket连接
        if (this.state.wsConnection) {
            this.state.wsConnection.close();
            this.state.wsConnection = null;
        }

        // 清除状态
        this.state.currentUser = null;
        this.state.currentFeedbackId = null;
        this.state.feedbacks = [];

        // 清除本地存储
        StorageUtils.clearUserData();

        // 更新UI
        this.updateUIAfterLogout();

        this.showAlert('已退出登录', 'info');
    }

    /**
     * 更新登录后的UI
     */
    updateUIAfterLogin() {
        this.elements.username.textContent = this.state.currentUser.username;
        this.elements.loginBtn.style.display = 'none';
        this.elements.logoutBtn.style.display = 'block';

        // 更新页面标题，显示当前登录用户（支持多标签页识别）
        document.title = `反馈系统 - 商家端 (${this.state.currentUser.username})`;
    }

    /**
     * 更新登出后的UI
     */
    updateUIAfterLogout() {
        this.elements.username.textContent = '未登录';
        this.elements.loginBtn.style.display = 'block';
        this.elements.logoutBtn.style.display = 'none';

        // 恢复页面标题
        document.title = '反馈系统 - 商家端';

        // 清空反馈列表
        this.elements.feedbackList.innerHTML = '';

        // 清空聊天区域
        this.elements.currentFeedbackTitle.textContent = '请选择一个反馈';
        this.elements.currentFeedbackStatus.textContent = '';
        this.elements.chatContainer.innerHTML = '';
        this.elements.noChatSelected.style.display = 'block';
        this.elements.messageInputArea.style.display = 'none';
        this.elements.statusDropdown.style.display = 'none';
    }

    /**
     * 连接WebSocket
     */
    connectWebSocket() {
        if (!this.state.currentUser) return;

        const token = StorageUtils.getToken();
        if (!token) {
            this.showAlert('登录已过期，请重新登录', 'warning');
            this.handleLogout();
            return;
        }

        // 关闭已有连接
        if (this.state.wsConnection) {
            this.state.wsConnection.close();
        }

        // 构建WebSocket URL
        const wsUrl = `${CONFIG.WS_URL}?user_id=${this.state.currentUser.id}&user_type=${CONFIG.USER_TYPE_NUMBERS.MERCHANT}&user_name=${this.state.currentUser.username}&token=${token}`;

        // 创建WebSocket连接
        this.state.wsConnection = new WebSocket(wsUrl);

        // 连接事件处理
        this.state.wsConnection.onopen = () => {
            console.log('WebSocket连接已建立');
            this.showAlert('实时消息连接已建立', 'success');
        };

        this.state.wsConnection.onmessage = (event) => {
            this.handleWebSocketMessage(event.data);
        };

        this.state.wsConnection.onclose = (event) => {
            console.log('WebSocket连接已关闭', event.code, event.reason);
            if (event.code === 1008) {
                this.showAlert('认证失败，请重新登录', 'warning');
                this.handleLogout();
            }
        };

        this.state.wsConnection.onerror = (error) => {
            console.error('WebSocket错误:', error);
            this.showAlert('实时消息连接出错', 'danger');
        };
    }

    /**
     * 处理WebSocket消息
     * @param {string} data - 消息数据
     */
    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            console.log('商家端收到WebSocket消息:', message);

            switch (message.event) {
                case CONFIG.WS_EVENT_TYPE.CONNECT:
                    console.log('用户已连接:', message.sender);
                    break;

                case CONFIG.WS_EVENT_TYPE.DISCONNECT:
                    console.log('用户已断开连接:', message.sender);
                    break;

                case CONFIG.WS_EVENT_TYPE.MESSAGE:
                    this.handleIncomingMessage(message);
                    break;

                case CONFIG.WS_EVENT_TYPE.TYPING:
                    this.handleTypingEvent(message);
                    break;

                case CONFIG.WS_EVENT_TYPE.READ:
                    this.handleReadEvent(message);
                    break;

                case CONFIG.WS_EVENT_TYPE.STATUS_CHANGE:
                    this.handleStatusChangeEvent(message);
                    break;

                case CONFIG.WS_EVENT_TYPE.FEEDBACK_DELETE:
                    console.log('商家端收到反馈删除事件:', message);
                    this.handleFeedbackDeleteEvent(message);
                    break;

                case CONFIG.WS_EVENT_TYPE.NEW_FEEDBACK:
                    this.handleNewFeedbackEvent(message);
                    break;

                default:
                    console.warn('未知的WebSocket事件类型:', message.event);
            }
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    }

    /**
     * 处理接收到的消息
     * @param {Object} message - 消息对象
     */
    handleIncomingMessage(message) {
        // 检查消息是否属于当前反馈
        if (Number(message.data.feedbackId) === Number(this.state.currentFeedbackId)) {
            // 如果是自己发送的消息，不重复显示
            if (Number(message.sender.id) === Number(this.state.currentUser.id)) {
                return;
            }

            this.appendMessage(message);
            this.scrollChatToBottom();

            // 如果不是自己发送的消息，则发送已读回执
            if (Number(message.sender.id) !== Number(this.state.currentUser.id)) {
                this.sendReadEvent(message.data.messageId);
            }
        } else {
            // 如果消息不属于当前反馈，显示通知
            if (Number(message.sender.id) !== Number(this.state.currentUser.id)) {
                const feedback = this.state.feedbacks.find(f => Number(f.id) === Number(message.data.feedbackId));
                const feedbackTitle = feedback ? feedback.title : '未知反馈';
                this.showAlert(`收到新消息来自: ${feedbackTitle}`, 'info');
            }
        }

        // 更新反馈列表中的未读消息计数
        this.updateUnreadCount(message.data.feedbackId);
    }

    /**
     * 处理正在输入事件
     * @param {Object} message - 消息对象
     */
    handleTypingEvent(message) {
        if (message.data.feedbackId === this.state.currentFeedbackId &&
            Number(message.sender.id) !== Number(this.state.currentUser.id)) {
            this.elements.typingIndicator.textContent = `${message.sender.name} 正在输入...`;

            setTimeout(() => {
                this.elements.typingIndicator.textContent = '';
            }, CONFIG.UI.MESSAGE.TYPING_TIMEOUT);
        }
    }

    /**
     * 处理已读事件
     * @param {Object} message - 消息对象
     */
    handleReadEvent(message) {
        console.log('消息已读:', message.data.messageId);
    }

    /**
     * 处理新反馈事件
     * @param {Object} message - 新反馈消息
     */
    handleNewFeedbackEvent(message) {
        // 商家需要看到所有发给自己的反馈，以及自己创建的反馈
        if (Number(message.receiver.id) === Number(this.state.currentUser.id) ||
            Number(message.sender.id) === Number(this.state.currentUser.id)) {
            this.loadFeedbacks();
            if (Number(message.receiver.id) === Number(this.state.currentUser.id)) {
                this.showAlert(`收到新的反馈: ${message.data.title}`, 'info');
            }
        }
    }

    /**
     * 处理状态变更事件
     * @param {Object} message - 消息对象
     */
    handleStatusChangeEvent(message) {
        // 后端发送的字段是下划线格式，需要兼容处理
        const feedbackId = message.data.feedback_id || message.data.feedbackId;
        const newStatus = message.data.new_status || message.data.newStatus;

        console.log('商家端处理状态变更:', { feedbackId, newStatus, data: message.data });

        this.updateFeedbackStatus(feedbackId, newStatus);

        if (Number(feedbackId) === Number(this.state.currentFeedbackId)) {
            this.elements.currentFeedbackStatus.innerHTML = this.getStatusText(newStatus);

            // 更新消息输入状态
            this.updateMessageInputState(newStatus);

            const systemMessage = {
                event: CONFIG.WS_EVENT_TYPE.MESSAGE,
                sender: {
                    id: 0,
                    type: 0,
                    name: '系统'
                },
                data: {
                    messageId: Date.now().toString(),
                    feedbackId: this.state.currentFeedbackId,
                    content: `反馈状态已更新为: ${this.getStatusText(newStatus)}`,
                    messageType: CONFIG.MESSAGE_TYPE.SYSTEM,
                    createdAt: new Date().toISOString()
                }
            };

            this.appendMessage(systemMessage, true);
            this.scrollChatToBottom();
        }

        // 根据筛选条件重新渲染列表
        this.renderFeedbackList();

        // 更新统计信息（如果有统计功能）
        if (typeof this.loadStatistics === 'function') {
            this.loadStatistics();
        }
    }

    /**
     * 处理反馈删除事件
     * @param {Object} message - 消息对象
     */
    handleFeedbackDeleteEvent(message) {
        // 后端发送的字段是下划线格式，需要兼容处理
        const feedbackId = message.data.feedback_id || message.data.feedbackId;

        console.log('商家端处理反馈删除:', { feedbackId, data: message.data });

        // 从本地状态中移除反馈
        this.state.feedbacks = this.state.feedbacks.filter(f => Number(f.id) !== Number(feedbackId));

        // 重新渲染反馈列表
        this.renderFeedbackList();

        // 如果删除的是当前查看的反馈，清空聊天区域
        if (Number(feedbackId) === Number(this.state.currentFeedbackId)) {
            this.state.currentFeedbackId = null;
            if (this.elements.noChatSelected) {
                this.elements.noChatSelected.style.display = 'block';
            }
            if (this.elements.messageInputArea) {
                this.elements.messageInputArea.style.display = 'none';
            }
            if (this.elements.chatContainer) {
                this.elements.chatContainer.innerHTML = '';
            }
        }

        this.showAlert('反馈已被删除', 'info');
    }

    /**
     * 处理筛选条件变更
     * @param {HTMLElement} target - 点击的目标元素
     */
    handleFilterChange(target) {
        // 更新选中状态
        this.elements.filterItems.forEach(item => item.classList.remove('active'));
        target.classList.add('active');

        // 设置当前筛选条件
        this.state.currentFilter = target.dataset.filter;

        // 重新渲染反馈列表
        this.renderFeedbackList();
    }

    /**
     * 处理状态变更
     * @param {HTMLElement} target - 点击的目标元素
     */
    async handleStatusChange(target) {
        if (!this.state.currentFeedbackId) return;

        const newStatus = target.dataset.status;
        await this.updateFeedbackStatusOnServer(this.state.currentFeedbackId, newStatus);
    }

    /**
     * 加载反馈列表
     */
    async loadFeedbacks() {
        if (!this.state.currentUser) return;

        try {
            // 商家需要获取两种反馈：1. 发给自己的反馈 2. 自己创建的反馈
            const [targetResponse, creatorResponse] = await Promise.all([
                // 获取发给自己的反馈（用户向商家的反馈）
                // 前后端对接：GET /api/feedback/target?target_id=X&target_type=1 → internal/handler/feedback.go GetByTarget()方法
                // 查询参数：target_id(商家ID), target_type(目标类型：1=商家)
                HttpUtils.get(`${CONFIG.ENDPOINTS.FEEDBACK.GET_BY_TARGET}?target_id=${this.state.currentUser.id}&target_type=${CONFIG.TARGET_TYPE.MERCHANT}`),
                // 获取自己创建的反馈（商家向管理员的反馈）
                // 前后端对接：GET /api/feedback/creator?creator_id=X&creator_type=2 → internal/handler/feedback.go GetByCreator()方法
                // 查询参数：creator_id(商家ID), creator_type(用户类型：2=商家)
                HttpUtils.get(`${CONFIG.ENDPOINTS.FEEDBACK.GET_BY_CREATOR}?creator_id=${this.state.currentUser.id}&creator_type=${CONFIG.USER_TYPE_NUMBERS.MERCHANT}`)
            ]);

            // 合并两种反馈，去重
            const targetFeedbacks = targetResponse.data || [];
            const creatorFeedbacks = creatorResponse.data || [];

            // 使用Map去重，以ID为键
            const feedbackMap = new Map();
            [...targetFeedbacks, ...creatorFeedbacks].forEach(feedback => {
                feedbackMap.set(feedback.id, feedback);
            });

            this.state.feedbacks = Array.from(feedbackMap.values());
            this.renderFeedbackList();
        } catch (error) {
            console.error('加载反馈列表失败:', error);
            this.showAlert('加载反馈列表失败: ' + error.message, 'danger');
        }
    }

    /**
     * 渲染反馈列表
     */
    renderFeedbackList() {
        this.elements.feedbackList.innerHTML = '';

        if (this.state.feedbacks.length === 0) {
            this.elements.feedbackList.innerHTML = '<div class="list-group-item text-center text-muted">暂无反馈</div>';
            return;
        }

        // 根据筛选条件过滤反馈
        let filteredFeedbacks;
        if (this.state.currentFilter === 'all') {
            filteredFeedbacks = this.state.feedbacks;
        } else {
            // 将筛选条件转换为状态值
            const statusValue = this.getStatusValue(this.state.currentFilter);
            filteredFeedbacks = this.state.feedbacks.filter(feedback => feedback.status === statusValue);
        }

        if (filteredFeedbacks.length === 0) {
            this.elements.feedbackList.innerHTML = '<div class="list-group-item text-center text-muted">没有符合条件的反馈</div>';
            return;
        }

        filteredFeedbacks.forEach(feedback => {
            const item = document.createElement('div');
            item.className = `list-group-item feedback-item ${Number(feedback.id) === Number(this.state.currentFeedbackId) ? 'active' : ''}`;
            item.dataset.id = feedback.id;

            const statusClass = this.getStatusClass(feedback.status);

            item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-1 fw-bold text-dark">${feedback.title}</h6>
                <span class="badge ${statusClass}">${this.getStatusText(feedback.status)}</span>
            </div>
            <p class="mb-2 text-truncate text-muted">${feedback.content}</p>
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted"><i class="fas fa-calendar-alt me-1"></i>${DateTimeUtils.formatDate(feedback.created_at)}</small>
                ${feedback.unreadCount ? `<span class="badge bg-danger rounded-pill">${feedback.unreadCount}</span>` : ''}
            </div>
        `;

            item.addEventListener('click', () => {
                this.selectFeedback(feedback.id);
            });

            this.elements.feedbackList.appendChild(item);
        });
    }

    /**
     * 选择反馈
     * @param {number} feedbackId - 反馈ID
     */
    async selectFeedback(feedbackId) {
        if (Number(feedbackId) === Number(this.state.currentFeedbackId)) return;

        this.state.currentFeedbackId = feedbackId;

        // 更新反馈列表选中状态
        document.querySelectorAll('.feedback-item').forEach(item => {
            item.classList.toggle('active', Number(item.dataset.id) === Number(feedbackId));
        });

        // 获取当前反馈详情
        const feedback = this.state.feedbacks.find(f => Number(f.id) === Number(feedbackId));
        if (feedback) {
            this.elements.currentFeedbackTitle.textContent = feedback.title;
            this.elements.currentFeedbackStatus.innerHTML = this.getStatusText(feedback.status);

            // 检查反馈状态，如果已解决则禁用消息输入
            this.updateMessageInputState(feedback.status);
        }

        // 显示消息输入区域和状态下拉菜单
        this.elements.noChatSelected.style.display = 'none';
        this.elements.messageInputArea.style.display = 'block';
        this.elements.statusDropdown.style.display = 'block';

        // 清空聊天区域
        this.elements.chatContainer.innerHTML = '';

        // 加载反馈消息
        await this.loadFeedbackMessages(feedbackId);
    }

    /**
     * 加载反馈消息
     * @param {number} feedbackId - 反馈ID
     */
    async loadFeedbackMessages(feedbackId) {
        try {
            // 前后端对接：GET /api/message/feedback/{feedbackId} → internal/handler/feedback_message.go GetByFeedbackID()方法
            // 路径参数：feedback_id(反馈ID)
            // 响应数据：{code, message, data: [消息列表]}
            const response = await HttpUtils.get(`${CONFIG.ENDPOINTS.FEEDBACK_MESSAGE.GET_BY_FEEDBACK_ID}${feedbackId}`);
            const messages = response.data || [];

            // 渲染消息
            messages.forEach(message => {
                // 根据发送者类型确定默认名称
                let defaultName = '用户';
                if (message.sender_type === CONFIG.USER_TYPE_NUMBERS.MERCHANT) {
                    defaultName = '商家';
                } else if (message.sender_type === CONFIG.USER_TYPE_NUMBERS.ADMIN) {
                    defaultName = '管理员';
                }

                const wsMessage = {
                    event: CONFIG.WS_EVENT_TYPE.MESSAGE,
                    sender: {
                        id: message.sender_id, // 直接使用数字ID
                        name: message.sender_name || defaultName,
                        type: message.sender_type
                    },
                    data: {
                        messageId: Number(message.id),
                        feedbackId: Number(message.feedback_id),
                        content: message.content,
                        messageType: Number(message.content_type),
                        createdAt: message.created_at
                    }
                };

                this.appendMessage(wsMessage);
            });

            this.scrollChatToBottom();
            this.updateFeedbackUnreadStatus(feedbackId);
        } catch (error) {
            console.error('加载反馈消息失败:', error);
            this.showAlert('加载反馈消息失败: ' + error.message, 'danger');
        }
    }

    /**
     * 发送消息
     */
    async sendMessage() {
        if (!this.state.currentUser || !this.state.currentFeedbackId || !this.state.wsConnection) {
            this.showAlert('无法发送消息', 'warning');
            return;
        }

        const content = this.elements.messageInput.value.trim();
        if (!content) return;

        if (content.length > CONFIG.UI.MESSAGE.MAX_LENGTH) {
            this.showAlert(`消息长度不能超过${CONFIG.UI.MESSAGE.MAX_LENGTH}个字符`, 'warning');
            return;
        }

        // 获取当前反馈信息以确定接收者
        const currentFeedback = this.state.feedbacks.find(f => Number(f.id) === Number(this.state.currentFeedbackId));
        if (!currentFeedback) {
            this.showAlert('无法找到当前反馈信息', 'warning');
            return;
        }

        // 创建消息对象
        const messageId = Date.now().toString();
        const message = {
            event: CONFIG.WS_EVENT_TYPE.MESSAGE,
            sender: {
                id: this.state.currentUser.id, // 直接使用数字类型的ID
                type: CONFIG.USER_TYPE_NUMBERS.MERCHANT,
                name: this.state.currentUser.username
            },
            receiver: {
                id: currentFeedback.creator_id,
                type: currentFeedback.creator_type
            },
            data: {
                messageId: messageId,
                feedbackId: this.state.currentFeedbackId,
                content: content,
                messageType: CONFIG.MESSAGE_TYPE.TEXT,
                createdAt: new Date().toISOString()
            }
        };

        // 清空输入框
        this.elements.messageInput.value = '';

        // 立即显示自己发送的消息
        this.appendMessage(message);
        this.scrollChatToBottom();

        // 保存消息到数据库（后端会自动广播WebSocket消息给其他用户）
        await this.saveMessageToDatabase(message);
    }

    /**
     * 保存消息到数据库
     * @param {Object} message - 消息对象
     */
    async saveMessageToDatabase(message) {
        try {
            const messageData = {
                feedback_id: Number(message.data.feedbackId),
                content: message.data.content,
                content_type: Number(message.data.messageType),
                sender_id: Number(this.state.currentUser.id),
                sender_type: Number(CONFIG.USER_TYPE_NUMBERS.MERCHANT)
            };

            // 前后端对接：POST /api/message → internal/handler/feedback_message.go Create()方法
            // 请求数据：{feedback_id, content, content_type, sender_id, sender_type}
            // 响应数据：{code, message, data: 创建的消息对象}
            // 注意：创建消息后，后端会通过WebSocket自动推送给相关用户
            await HttpUtils.post(CONFIG.ENDPOINTS.FEEDBACK_MESSAGE.CREATE, messageData);
        } catch (error) {
            console.error('保存消息到数据库失败:', error);
        }
    }



    /**
     * 处理图片选择
     */
    async handleImageSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        const validFiles = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                this.showAlert('只能上传图片文件', 'warning');
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                this.showAlert('图片大小不能超过5MB', 'warning');
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) return;
        this.showImagePreview(validFiles);
    }

    /**
     * 显示图片预览
     */
    showImagePreview(files) {
        this.elements.imagePreview.innerHTML = '';

        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'd-inline-block me-2 mb-2 position-relative';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;">
                    <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0"
                            onclick="this.parentElement.remove()" style="transform: translate(50%, -50%);">×</button>
                `;
                this.elements.imagePreview.appendChild(previewDiv);
            };
            reader.readAsDataURL(file);
        });

        const sendImageBtn = document.createElement('button');
        sendImageBtn.className = 'btn btn-sm btn-success mt-2';
        sendImageBtn.textContent = '发送图片';
        sendImageBtn.onclick = () => this.sendImages(files);
        this.elements.imagePreview.appendChild(sendImageBtn);
    }

    /**
     * 发送图片消息
     */
    async sendImages(files) {
        if (!this.state.currentUser || !this.state.currentFeedbackId || !this.state.wsConnection) {
            this.showAlert('无法发送图片', 'warning');
            return;
        }

        try {
            const imageUrls = [];
            for (const file of files) {
                const formData = new FormData();
                formData.append('image', file);

                const response = await HttpUtils.post('/upload/image', formData);
                imageUrls.push(response.data.url);
            }

            const currentFeedback = this.state.feedbacks.find(f => Number(f.id) === Number(this.state.currentFeedbackId));
            if (!currentFeedback) {
                this.showAlert('无法找到当前反馈信息', 'warning');
                return;
            }

            const messageId = Date.now().toString();
            const message = {
                event: CONFIG.WS_EVENT_TYPE.MESSAGE,
                sender: {
                    id: this.state.currentUser.id,
                    type: CONFIG.USER_TYPE_NUMBERS.MERCHANT,
                    name: this.state.currentUser.username
                },
                receiver: {
                    id: currentFeedback.creator_id,
                    type: currentFeedback.creator_type
                },
                data: {
                    messageId: messageId,
                    feedbackId: this.state.currentFeedbackId,
                    content: files.length === 1 ? imageUrls[0] : JSON.stringify(imageUrls),
                    messageType: files.length === 1 ? CONFIG.MESSAGE_TYPE.IMAGE : CONFIG.MESSAGE_TYPE.IMAGE_ARRAY,
                    createdAt: new Date().toISOString()
                }
            };

            // 只通过API发送消息（后端会自动广播WebSocket消息）
            await this.saveMessageToDatabase(message);

            // 立即显示自己发送的图片消息
            this.appendMessage(message);
            this.scrollChatToBottom();

            this.elements.imagePreview.innerHTML = '';
            this.elements.imageInput.value = '';

        } catch (error) {
            console.error('发送图片失败:', error);
            this.showAlert('发送图片失败: ' + error.message, 'danger');
        }
    }

    /**
     * 处理图片选择
     */
    async handleImageSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        const validFiles = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                this.showAlert('只能上传图片文件', 'warning');
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                this.showAlert('图片大小不能超过5MB', 'warning');
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) return;
        this.showImagePreview(validFiles);
    }

    /**
     * 显示图片预览
     */
    showImagePreview(files) {
        this.elements.imagePreview.innerHTML = '';

        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'd-inline-block me-2 mb-2 position-relative';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" class="img-thumbnail" style="width: 80px; height: 80px; object-fit: cover;">
                    <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0"
                            onclick="this.parentElement.remove()" style="transform: translate(50%, -50%);">×</button>
                `;
                this.elements.imagePreview.appendChild(previewDiv);
            };
            reader.readAsDataURL(file);
        });

        const sendImageBtn = document.createElement('button');
        sendImageBtn.className = 'btn btn-sm btn-success mt-2';
        sendImageBtn.textContent = '发送图片';
        sendImageBtn.onclick = () => this.sendImages(files);
        this.elements.imagePreview.appendChild(sendImageBtn);
    }



    /**
     * 处理正在输入
     */
    handleTyping() {
        if (!this.state.currentUser || !this.state.currentFeedbackId || !this.state.wsConnection) return;

        // 清除之前的超时
        if (this.state.typingTimeout) {
            clearTimeout(this.state.typingTimeout);
        }

        // 发送正在输入事件
        this.sendTypingEvent();

        // 设置新的超时
        this.state.typingTimeout = setTimeout(() => {
            // 停止输入状态
        }, CONFIG.UI.MESSAGE.TYPING_TIMEOUT);
    }

    /**
     * 发送正在输入事件
     */
    sendTypingEvent() {
        if (!this.state.currentUser || !this.state.currentFeedbackId || !this.state.wsConnection) return;

        const typingEvent = {
            event: CONFIG.WS_EVENT_TYPE.TYPING,
            sender: {
                id: this.state.currentUser.id,
                type: CONFIG.USER_TYPE_NUMBERS.MERCHANT,
                name: this.state.currentUser.username
            },
            receiver: {
                id: 0,
                type: 0
            },
            data: {
                feedbackId: this.state.currentFeedbackId
            }
        };

        this.state.wsConnection.send(JSON.stringify(typingEvent));
    }

    /**
     * 发送已读事件
     * @param {string} messageId - 消息ID
     */
    async sendReadEvent(messageId) {
        if (!this.state.currentUser || !this.state.currentFeedbackId || !this.state.wsConnection) return;

        const readEvent = {
            event: CONFIG.WS_EVENT_TYPE.READ,
            sender: {
                id: this.state.currentUser.id,
                type: CONFIG.USER_TYPE_NUMBERS.MERCHANT,
                name: this.state.currentUser.username
            },
            receiver: {
                id: 0,
                type: 0
            },
            data: {
                messageId: messageId,
                feedbackId: this.state.currentFeedbackId
            }
        };

        this.state.wsConnection.send(JSON.stringify(readEvent));

        // 同时调用API更新消息已读状态
        await this.updateMessageReadStatus(messageId);
    }

    /**
     * 更新消息已读状态
     * @param {string} messageId - 消息ID
     */
    async updateMessageReadStatus(messageId) {
        try {
            await HttpUtils.put(`/message/${messageId}/read`);
        } catch (error) {
            console.error('更新消息已读状态失败:', error);
        }
    }

    /**
     * 在服务器上更新反馈状态
     * @param {number} feedbackId - 反馈ID
     * @param {string} newStatus - 新状态
     */
    async updateFeedbackStatusOnServer(feedbackId, newStatus) {
        try {
            const statusValue = this.getStatusValue(newStatus);

            const response = await HttpUtils.put(`/feedback/${feedbackId}/status`, {
                status: statusValue
            });

            // 本地更新状态（WebSocket会通知所有客户端）
            this.updateFeedbackStatus(feedbackId, newStatus);

            // 更新当前反馈状态显示
            if (Number(feedbackId) === Number(this.state.currentFeedbackId)) {
                this.elements.currentFeedbackStatus.innerHTML = this.getStatusText(newStatus);
            }

            // 重新渲染反馈列表以更新状态标签
            this.renderFeedbackList();

            this.showAlert('反馈状态已更新', 'success');
        } catch (error) {
            console.error('更新反馈状态失败:', error);
            this.showAlert('更新反馈状态失败: ' + error.message, 'danger');
        }
    }

    /**
     * 添加消息到聊天区域
     * @param {Object} message - 消息对象
     * @param {boolean} isSystem - 是否为系统消息
     */
    appendMessage(message, isSystem = false) {
        const isCurrentUser = Number(message.sender.id) === Number(this.state.currentUser?.id);
        const messageDiv = document.createElement('div');

        if (isSystem) {
            messageDiv.className = 'message message-system';
            messageDiv.innerHTML = `
            <div class="message-content">${message.data.content}</div>
        `;
        } else {
            messageDiv.className = `message ${isCurrentUser ? 'message-sent' : 'message-received'}`;

            let contentHtml = '';
            switch (message.data.messageType) {
                case CONFIG.MESSAGE_TYPE.TEXT:
                    contentHtml = `<div class="message-content">${message.data.content}</div>`;
                    break;
                case CONFIG.MESSAGE_TYPE.IMAGE:
                    contentHtml = `
                        <div class="message-content">
                            <img src="${message.data.content}" class="img-fluid rounded" style="max-width: 200px; cursor: pointer;"
                                 onclick="window.open('${message.data.content}', '_blank')">
                        </div>
                    `;
                    break;
                case CONFIG.MESSAGE_TYPE.IMAGE_ARRAY:
                    const imageUrls = JSON.parse(message.data.content);
                    const imagesHtml = imageUrls.map(url =>
                        `<img src="${url}" class="img-fluid rounded me-1 mb-1" style="max-width: 150px; cursor: pointer;"
                              onclick="window.open('${url}', '_blank')">`
                    ).join('');
                    contentHtml = `<div class="message-content">${imagesHtml}</div>`;
                    break;
                default:
                    contentHtml = `<div class="message-content">${message.data.content}</div>`;
            }

            messageDiv.innerHTML = `
                ${contentHtml}
                <div class="message-info">
                    <span>${message.sender.name}</span> ·
                    <span>${DateTimeUtils.formatDateTime(message.data.createdAt)}</span>
                </div>
            `;
        }

        this.elements.chatContainer.appendChild(messageDiv);
    }

    /**
     * 滚动聊天区域到底部
     */
    scrollChatToBottom() {
        setTimeout(() => {
            this.elements.chatContainer.scrollTop = this.elements.chatContainer.scrollHeight;
        }, CONFIG.UI.MESSAGE.AUTO_SCROLL_DELAY);
    }

    /**
     * 更新反馈状态
     * @param {number} feedbackId - 反馈ID
     * @param {string} newStatus - 新状态
     */
    updateFeedbackStatus(feedbackId, newStatus) {
        const feedback = this.state.feedbacks.find(f => Number(f.id) === Number(feedbackId));
        if (feedback) {
            // newStatus 可能是字符串或数字，统一处理
            feedback.status = typeof newStatus === 'string' ? this.getStatusValue(newStatus) : newStatus;
            this.renderFeedbackList();
        }
    }

    /**
     * 更新未读消息计数
     * @param {number} feedbackId - 反馈ID
     */
    updateUnreadCount(feedbackId) {
        if (Number(feedbackId) !== Number(this.state.currentFeedbackId)) {
            const feedback = this.state.feedbacks.find(f => Number(f.id) === Number(feedbackId));
            if (feedback) {
                feedback.unreadCount = (feedback.unreadCount || 0) + 1;
                this.renderFeedbackList();
            }
        }
    }

    /**
     * 更新反馈未读消息状态
     * @param {number} feedbackId - 反馈ID
     */
    updateFeedbackUnreadStatus(feedbackId) {
        const feedback = this.state.feedbacks.find(f => Number(f.id) === Number(feedbackId));
        if (feedback) {
            feedback.unreadCount = 0;
            this.renderFeedbackList();
        }
    }

    /**
     * 获取状态文本
     * @param {number} status - 状态值
     * @returns {string} 状态文本
     */
    getStatusText(status) {
        switch (status) {
            case CONFIG.FEEDBACK_STATUS.OPEN:
                return '<i class="fas fa-clock me-1"></i>待处理';
            case CONFIG.FEEDBACK_STATUS.IN_PROGRESS:
                return '<i class="fas fa-spinner me-1"></i>处理中';
            case CONFIG.FEEDBACK_STATUS.RESOLVED:
                return '<i class="fas fa-check-circle me-1"></i>已解决';
            default:
                return '<i class="fas fa-question me-1"></i>未知状态';
        }
    }

    /**
     * 获取状态CSS类
     * @param {number} status - 状态值
     * @returns {string} CSS类名
     */
    getStatusClass(status) {
        switch (status) {
            case CONFIG.FEEDBACK_STATUS.OPEN:
                return 'status-open';
            case CONFIG.FEEDBACK_STATUS.IN_PROGRESS:
                return 'status-in-progress';
            case CONFIG.FEEDBACK_STATUS.RESOLVED:
                return 'status-resolved';
            default:
                return 'bg-secondary';
        }
    }

    /**
     * 获取状态值
     * @param {string} status - 状态字符串
     * @returns {number} 状态值
     */
    getStatusValue(status) {
        switch (status) {
            case 'open':
                return CONFIG.FEEDBACK_STATUS.OPEN;
            case 'in_progress':
                return CONFIG.FEEDBACK_STATUS.IN_PROGRESS;
            case 'resolved':
                return CONFIG.FEEDBACK_STATUS.RESOLVED;
            case 'closed':
                return CONFIG.FEEDBACK_STATUS.CLOSED;
            default:
                return CONFIG.FEEDBACK_STATUS.OPEN;
        }
    }

    /**
     * 显示提示信息
     * @param {string} message - 提示信息
     * @param {string} type - 提示类型
     */
    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

        document.body.appendChild(alertDiv);

        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, CONFIG.UI.ALERT.AUTO_HIDE_DELAY);
    }

    /**
     * 更新消息输入状态
     * @param {number} feedbackStatus - 反馈状态
     */
    updateMessageInputState(feedbackStatus) {
        const isResolved = feedbackStatus === CONFIG.FEEDBACK_STATUS.RESOLVED; // 状态为3表示已解决

        // 禁用或启用输入框和发送按钮
        this.elements.messageInput.disabled = isResolved;
        this.elements.sendMessageBtn.disabled = isResolved;
        this.elements.imageBtn.disabled = isResolved;

        if (isResolved) {
            this.elements.messageInput.placeholder = '反馈已解决，无法发送新消息';
            this.elements.messageInputArea.classList.add('disabled');
        } else {
            this.elements.messageInput.placeholder = '输入消息...';
            this.elements.messageInputArea.classList.remove('disabled');
        }
    }

    /**
     * 处理系统反馈提交
     */
    async handleSubmitSystemFeedback() {
        if (!this.state.currentUser) {
            this.showAlert('请先登录', 'warning');
            return;
        }

        const title = this.elements.systemFeedbackTitle.value.trim();
        const content = this.elements.systemFeedbackContent.value.trim();
        // 使用用户注册时的联系方式
        const contact = this.state.currentUser.contact || '';

        // 输入验证
        if (!title || !content) {
            this.showAlert('请填写问题标题和详情', 'warning');
            return;
        }

        if (title.length > 255) {
            this.showAlert('问题标题不能超过255个字符', 'warning');
            return;
        }

        if (content.length > 1000) {
            this.showAlert('问题详情不能超过1000个字符', 'warning');
            return;
        }

        try {
            const feedbackData = {
                title: title,
                content: content,
                contact: contact,
                creator_id: this.state.currentUser.id,
                creator_type: CONFIG.USER_TYPE_NUMBERS.MERCHANT,
                target_id: 1, // 管理员ID固定为1
                target_type: CONFIG.TARGET_TYPE.ADMIN
            };

            const response = await HttpUtils.post(CONFIG.ENDPOINTS.FEEDBACK.CREATE, feedbackData);

            // 关闭模态框
            this.elements.systemFeedbackModal.hide();

            // 重置表单
            this.elements.systemFeedbackForm.reset();

            this.showAlert('系统反馈已提交，管理员会尽快处理', 'success');
        } catch (error) {
            console.error('提交系统反馈失败:', error);
            this.showAlert('提交系统反馈失败: ' + error.message, 'danger');
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.merchantApp = new MerchantApp();
});