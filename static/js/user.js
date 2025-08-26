/**
 * 反馈系统用户端JavaScript
 * 实现WebSocket连接、消息发送接收和反馈管理功能
 */

// 全局变量
let currentUser = null;
let currentFeedbackId = null;
let wsConnection = null;
let feedbackList = [];

// DOM元素
const elements = {
    username: document.getElementById('username'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    feedbackList: document.getElementById('feedbackList'),
    newFeedbackBtn: document.getElementById('newFeedbackBtn'),
    currentFeedbackTitle: document.getElementById('currentFeedbackTitle'),
    currentFeedbackStatus: document.getElementById('currentFeedbackStatus'),
    chatContainer: document.getElementById('chatContainer'),
    noChatSelected: document.getElementById('noChatSelected'),
    messageInputArea: document.getElementById('messageInputArea'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    typingIndicator: document.getElementById('typingIndicator'),
    loginModal: new bootstrap.Modal(document.getElementById('loginModal')),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    newFeedbackModal: new bootstrap.Modal(document.getElementById('newFeedbackModal')),
    newFeedbackForm: document.getElementById('newFeedbackForm'),
    feedbackTitle: document.getElementById('feedbackTitle'),
    feedbackContent: document.getElementById('feedbackContent'),
    feedbackType: document.getElementById('feedbackType'),
    submitFeedbackBtn: document.getElementById('submitFeedbackBtn')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 绑定事件
    bindEvents();
    
    // 检查本地存储中的用户信息
    checkUserLogin();
});

// 绑定事件
function bindEvents() {
    // 登录按钮点击事件
    elements.loginBtn.addEventListener('click', () => {
        elements.loginModal.show();
    });
    
    // 登录提交按钮点击事件
    elements.loginSubmitBtn.addEventListener('click', handleLogin);
    
    // 退出登录按钮点击事件
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // 新建反馈按钮点击事件
    elements.newFeedbackBtn.addEventListener('click', () => {
        if (!currentUser) {
            showAlert('请先登录', 'warning');
            elements.loginModal.show();
            return;
        }
        elements.newFeedbackModal.show();
    });
    
    // 提交反馈按钮点击事件
    elements.submitFeedbackBtn.addEventListener('click', handleSubmitFeedback);
    
    // 发送消息按钮点击事件
    elements.sendMessageBtn.addEventListener('click', sendMessage);
    
    // 消息输入框按键事件
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 消息输入框输入事件（发送正在输入状态）
    let typingTimeout;
    elements.messageInput.addEventListener('input', () => {
        if (!currentUser || !currentFeedbackId || !wsConnection) return;
        
        // 清除之前的超时
        clearTimeout(typingTimeout);
        
        // 发送正在输入事件
        sendTypingEvent();
        
        // 设置新的超时（3秒后停止显示正在输入）
        typingTimeout = setTimeout(() => {
            // 可以发送停止输入事件，但这里简化处理
        }, 3000);
    });
}

// 检查用户登录状态
function checkUserLogin() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // 验证令牌有效性
            const token = localStorage.getItem('token');
            if (token) {
                // 设置请求头中的Authorization
                setAuthHeader(token);
                // 验证令牌
                fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.USER.VALIDATE_TOKEN}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(response => {
                    if (response.ok) {
                        updateUIAfterLogin();
                        loadFeedbacks();
                        connectWebSocket();
                    } else {
                        // 令牌无效，清除登录状态
                        handleLogout();
                    }
                })
                .catch(error => {
                    console.error('验证令牌失败:', error);
                    handleLogout();
                });
            } else {
                // 没有令牌，清除登录状态
                handleLogout();
            }
        } catch (error) {
            console.error('解析保存的用户信息失败:', error);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
        }
    }
}

// 设置请求头中的Authorization
function setAuthHeader(token) {
    // 为后续的fetch请求添加拦截器，自动添加Authorization头
    window.originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // 如果没有设置headers，则创建一个新的headers对象
        if (!options.headers) {
            options.headers = {};
        }
        
        // 如果是对象形式的headers，添加Authorization
        if (options.headers.constructor === Object) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        return window.originalFetch(url, options);
    };
}

// 处理登录
async function handleLogin() {
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!username || !password) {
        showAlert('请输入用户名和密码', 'warning');
        return;
    }
    
    try {
        // 构建登录请求数据
        const loginData = {
            username: username,
            password: password,
            user_type: CONFIG.USER_TYPE.USER
        };
        
        // 发送登录请求
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.USER.LOGIN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        if (!response.ok) {
            throw new Error('登录失败: ' + (await response.text()));
        }
        
        const result = await response.json();
        
        // 保存用户信息和令牌
        currentUser = result.data.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('token', result.data.token);
        
        // 设置请求头中的Authorization
        setAuthHeader(result.data.token);
        
        // 更新UI
        updateUIAfterLogin();
        
        // 关闭登录模态框
        elements.loginModal.hide();
        
        // 重置表单
        elements.loginForm.reset();
        
        // 加载反馈列表
        loadFeedbacks();
        
        // 连接WebSocket
        connectWebSocket();
        
        showAlert('登录成功', 'success');
    } catch (error) {
        console.error('登录失败:', error);
        showAlert('登录失败: ' + error.message, 'danger');
    }
}

// 处理退出登录
function handleLogout() {
    // 关闭WebSocket连接
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
    
    // 清除用户信息和令牌
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    
    // 清除当前反馈
    currentFeedbackId = null;
    
    // 恢复原始的fetch函数
    if (window.originalFetch) {
        window.fetch = window.originalFetch;
        window.originalFetch = null;
    }
    
    // 更新UI
    elements.username.textContent = '未登录';
    elements.loginBtn.style.display = 'block';
    elements.logoutBtn.style.display = 'none';
    elements.feedbackList.innerHTML = '';
    elements.currentFeedbackTitle.textContent = '请选择或创建一个反馈';
    elements.currentFeedbackStatus.textContent = '';
    elements.chatContainer.innerHTML = '';
    elements.noChatSelected.style.display = 'block';
    elements.messageInputArea.style.display = 'none';
    
    showAlert('已退出登录', 'info');
}

// 更新登录后的UI
function updateUIAfterLogin() {
    elements.username.textContent = currentUser.username;
    elements.loginBtn.style.display = 'none';
    elements.logoutBtn.style.display = 'block';
}

// 连接WebSocket
function connectWebSocket() {
    if (!currentUser) return;
    
    // 关闭已有连接
    if (wsConnection) {
        wsConnection.close();
    }
    
    // 构建WebSocket URL，包含用户信息
    const wsUrl = `${CONFIG.WS_URL}?userId=${currentUser.id}&userType=${currentUser.userType}&username=${currentUser.username}`;
    
    // 创建WebSocket连接
    wsConnection = new WebSocket(wsUrl);
    
    // 连接打开事件
    wsConnection.onopen = () => {
        console.log('WebSocket连接已建立');
        showAlert('实时消息连接已建立', 'success');
    };
    
    // 接收消息事件
    wsConnection.onmessage = (event) => {
        handleWebSocketMessage(event.data);
    };
    
    // 连接关闭事件
    wsConnection.onclose = () => {
        console.log('WebSocket连接已关闭');
        // 可以在这里添加重连逻辑
    };
    
    // 连接错误事件
    wsConnection.onerror = (error) => {
        console.error('WebSocket错误:', error);
        showAlert('实时消息连接出错', 'danger');
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(data) {
    try {
        const message = JSON.parse(data);
        
        // 根据事件类型处理消息
        switch (message.event) {
            case CONFIG.WS_EVENT_TYPE.CONNECT:
                // 处理连接事件
                console.log('用户已连接:', message.sender);
                break;
                
            case CONFIG.WS_EVENT_TYPE.DISCONNECT:
                // 处理断开连接事件
                console.log('用户已断开连接:', message.sender);
                break;
                
            case CONFIG.WS_EVENT_TYPE.MESSAGE:
                // 处理消息事件
                handleIncomingMessage(message);
                break;
                
            case CONFIG.WS_EVENT_TYPE.TYPING:
                // 处理正在输入事件
                handleTypingEvent(message);
                break;
                
            case CONFIG.WS_EVENT_TYPE.READ:
                // 处理已读事件
                handleReadEvent(message);
                break;
                
            case CONFIG.WS_EVENT_TYPE.STATUS_CHANGE:
                // 处理状态变更事件
                handleStatusChangeEvent(message);
                break;
                
            default:
                console.warn('未知的WebSocket事件类型:', message.event);
        }
    } catch (error) {
        console.error('解析WebSocket消息失败:', error);
    }
}

// 处理接收到的消息
function handleIncomingMessage(message) {
    // 检查消息是否属于当前反馈
    if (message.data.feedbackId === currentFeedbackId) {
        // 添加消息到聊天区域
        appendMessage(message);
        
        // 滚动到底部
        scrollChatToBottom();
        
        // 如果不是自己发送的消息，则发送已读回执
        if (message.sender.id !== currentUser.id) {
            sendReadEvent(message.data.messageId);
        }
    }
    
    // 更新反馈列表中的未读消息计数
    updateUnreadCount(message.data.feedbackId);
}

// 处理正在输入事件
function handleTypingEvent(message) {
    // 检查是否是当前反馈的输入事件，且不是自己的输入
    if (message.data.feedbackId === currentFeedbackId && message.sender.id !== currentUser.id) {
        elements.typingIndicator.textContent = `${message.sender.username} 正在输入...`;
        
        // 3秒后清除输入提示
        setTimeout(() => {
            elements.typingIndicator.textContent = '';
        }, 3000);
    }
}

// 处理已读事件
function handleReadEvent(message) {
    // 可以在UI上更新消息的已读状态
    console.log('消息已读:', message.data.messageId);
}

// 处理状态变更事件
function handleStatusChangeEvent(message) {
    // 更新反馈列表中的状态
    updateFeedbackStatus(message.data.feedbackId, message.data.newStatus);
    
    // 如果是当前反馈，更新当前反馈状态
    if (message.data.feedbackId === currentFeedbackId) {
        elements.currentFeedbackStatus.textContent = getStatusText(message.data.newStatus);
        
        // 添加系统消息
        const systemMessage = {
            event: CONFIG.WS_EVENT_TYPE.MESSAGE,
            sender: {
                id: 'system',
                username: '系统',
                userType: 'system'
            },
            data: {
                messageId: Date.now().toString(),
                feedbackId: currentFeedbackId,
                content: `反馈状态已更新为: ${getStatusText(message.data.newStatus)}`,
                messageType: CONFIG.WS_MESSAGE_TYPE.TEXT,
                createdAt: new Date().toISOString()
            }
        };
        
        appendMessage(systemMessage, true);
        scrollChatToBottom();
    }
}

// 发送消息
function sendMessage() {
    if (!currentUser || !currentFeedbackId || !wsConnection) {
        showAlert('无法发送消息', 'warning');
        return;
    }
    
    const content = elements.messageInput.value.trim();
    if (!content) return;
    
    // 创建消息对象
    const messageId = Date.now().toString();
    const message = {
        event: CONFIG.WS_EVENT_TYPE.MESSAGE,
        sender: {
            id: currentUser.id,
            username: currentUser.username,
            userType: currentUser.userType
        },
        receiver: {
            id: 'all',  // 发送给所有人
            userType: 'all'
        },
        data: {
            messageId: messageId,
            feedbackId: currentFeedbackId,
            content: content,
            messageType: CONFIG.WS_MESSAGE_TYPE.TEXT,
            createdAt: new Date().toISOString()
        }
    };
    
    // 发送消息
    wsConnection.send(JSON.stringify(message));
    
    // 清空输入框
    elements.messageInput.value = '';
    
    // 添加消息到聊天区域（乐观更新）
    appendMessage(message);
    
    // 滚动到底部
    scrollChatToBottom();
    
    // 同时调用API保存消息到数据库
    saveMessageToDatabase(message);
}

// 保存消息到数据库
async function saveMessageToDatabase(message) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.FEEDBACK_MESSAGE.CREATE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                feedbackId: message.data.feedbackId,
                content: message.data.content,
                messageType: message.data.messageType,
                senderId: message.sender.id,
                senderType: message.sender.userType
            })
        });
        
        if (!response.ok) {
            throw new Error('保存消息失败');
        }
        
        const result = await response.json();
        console.log('消息已保存到数据库:', result);
    } catch (error) {
        console.error('保存消息到数据库失败:', error);
        // 可以在这里添加重试逻辑
    }
}

// 发送正在输入事件
function sendTypingEvent() {
    if (!currentUser || !currentFeedbackId || !wsConnection) return;
    
    const typingEvent = {
        event: CONFIG.WS_EVENT_TYPE.TYPING,
        sender: {
            id: currentUser.id,
            username: currentUser.username,
            userType: currentUser.userType
        },
        receiver: {
            id: 'all',
            userType: 'all'
        },
        data: {
            feedbackId: currentFeedbackId
        }
    };
    
    wsConnection.send(JSON.stringify(typingEvent));
}

// 发送已读事件
function sendReadEvent(messageId) {
    if (!currentUser || !currentFeedbackId || !wsConnection) return;
    
    const readEvent = {
        event: CONFIG.WS_EVENT_TYPE.READ,
        sender: {
            id: currentUser.id,
            username: currentUser.username,
            userType: currentUser.userType
        },
        receiver: {
            id: 'all',
            userType: 'all'
        },
        data: {
            messageId: messageId,
            feedbackId: currentFeedbackId
        }
    };
    
    wsConnection.send(JSON.stringify(readEvent));
    
    // 同时调用API更新消息已读状态
    updateMessageReadStatus(messageId);
}

// 更新消息已读状态
async function updateMessageReadStatus(messageId) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.FEEDBACK_MESSAGE.MARK_AS_READ}${messageId}`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            throw new Error('更新消息已读状态失败');
        }
        
        const result = await response.json();
        console.log('消息已读状态已更新:', result);
    } catch (error) {
        console.error('更新消息已读状态失败:', error);
    }
}

// 加载反馈列表
async function loadFeedbacks() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.FEEDBACK.GET_ALL}`);
        
        if (!response.ok) {
            throw new Error('获取反馈列表失败');
        }
        
        const result = await response.json();
        feedbackList = result.data || [];
        
        // 渲染反馈列表
        renderFeedbackList();
    } catch (error) {
        console.error('加载反馈列表失败:', error);
        showAlert('加载反馈列表失败: ' + error.message, 'danger');
    }
}

// 渲染反馈列表
function renderFeedbackList() {
    elements.feedbackList.innerHTML = '';
    
    if (feedbackList.length === 0) {
        elements.feedbackList.innerHTML = '<div class="list-group-item text-center text-muted">暂无反馈</div>';
        return;
    }
    
    feedbackList.forEach(feedback => {
        const item = document.createElement('div');
        item.className = `list-group-item feedback-item ${feedback.id === currentFeedbackId ? 'active' : ''}`;
        item.dataset.id = feedback.id;
        
        const statusClass = getStatusClass(feedback.status);
        
        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-1">${feedback.title}</h6>
                <span class="badge ${statusClass}">${getStatusText(feedback.status)}</span>
            </div>
            <p class="mb-1 text-truncate">${feedback.content}</p>
            <small class="text-muted">${formatDate(feedback.createdAt)}</small>
            ${feedback.unreadCount ? `<span class="unread-indicator" title="${feedback.unreadCount}条未读消息"></span>` : ''}
        `;
        
        item.addEventListener('click', () => selectFeedback(feedback.id));
        
        elements.feedbackList.appendChild(item);
    });
}

// 选择反馈
async function selectFeedback(feedbackId) {
    if (feedbackId === currentFeedbackId) return;
    
    currentFeedbackId = feedbackId;
    
    // 更新反馈列表选中状态
    document.querySelectorAll('.feedback-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id === feedbackId);
    });
    
    // 获取当前反馈详情
    const feedback = feedbackList.find(f => f.id === feedbackId);
    if (feedback) {
        elements.currentFeedbackTitle.textContent = feedback.title;
        elements.currentFeedbackStatus.textContent = getStatusText(feedback.status);
    }
    
    // 显示消息输入区域
    elements.noChatSelected.style.display = 'none';
    elements.messageInputArea.style.display = 'block';
    
    // 清空聊天区域
    elements.chatContainer.innerHTML = '';
    
    // 加载反馈消息
    loadFeedbackMessages(feedbackId);
}

// 加载反馈消息
async function loadFeedbackMessages(feedbackId) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.FEEDBACK_MESSAGE.GET_BY_FEEDBACK_ID}${feedbackId}`);
        
        if (!response.ok) {
            throw new Error('获取反馈消息失败');
        }
        
        const result = await response.json();
        const messages = result.data || [];
        
        // 渲染消息
        messages.forEach(message => {
            const wsMessage = {
                event: CONFIG.WS_EVENT_TYPE.MESSAGE,
                sender: {
                    id: message.senderId,
                    username: message.senderName || '用户',
                    userType: message.senderType
                },
                data: {
                    messageId: message.id,
                    feedbackId: message.feedbackId,
                    content: message.content,
                    messageType: message.messageType,
                    createdAt: message.createdAt
                }
            };
            
            appendMessage(wsMessage);
        });
        
        // 滚动到底部
        scrollChatToBottom();
        
        // 更新未读消息状态
        updateFeedbackUnreadStatus(feedbackId);
    } catch (error) {
        console.error('加载反馈消息失败:', error);
        showAlert('加载反馈消息失败: ' + error.message, 'danger');
    }
}

// 更新反馈未读消息状态
function updateFeedbackUnreadStatus(feedbackId) {
    const feedback = feedbackList.find(f => f.id === feedbackId);
    if (feedback) {
        feedback.unreadCount = 0;
        renderFeedbackList();
    }
}

// 添加消息到聊天区域
function appendMessage(message, isSystem = false) {
    const isCurrentUser = message.sender.id === currentUser?.id;
    const messageDiv = document.createElement('div');
    
    if (isSystem) {
        // 系统消息
        messageDiv.className = 'message message-system';
        messageDiv.innerHTML = `
            <div class="message-content">${message.data.content}</div>
        `;
    } else {
        // 用户消息
        messageDiv.className = `message ${isCurrentUser ? 'message-sent' : 'message-received'}`;
        messageDiv.innerHTML = `
            <div class="message-content">${message.data.content}</div>
            <div class="message-info">
                <span>${message.sender.username}</span> · 
                <span>${formatTime(message.data.createdAt)}</span>
            </div>
        `;
    }
    
    elements.chatContainer.appendChild(messageDiv);
}

// 滚动聊天区域到底部
function scrollChatToBottom() {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// 处理提交反馈
async function handleSubmitFeedback() {
    if (!currentUser) {
        showAlert('请先登录', 'warning');
        return;
    }
    
    const title = elements.feedbackTitle.value.trim();
    const content = elements.feedbackContent.value.trim();
    const type = elements.feedbackType.value;
    
    if (!title || !content || !type) {
        showAlert('请填写完整的反馈信息', 'warning');
        return;
    }
    
    try {
        // 获取令牌
        const token = localStorage.getItem('token');
        if (!token) {
            showAlert('登录已过期，请重新登录', 'warning');
            handleLogout();
            return;
        }
        
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.FEEDBACK.CREATE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: title,
                content: content,
                type: type,
                userId: currentUser.id,
                userType: currentUser.userType
            })
        });
        
        if (response.status === 401) {
            // 未授权，可能是令牌过期
            showAlert('登录已过期，请重新登录', 'warning');
            handleLogout();
            return;
        }
        
        if (!response.ok) {
            throw new Error('创建反馈失败');
        }
        
        const result = await response.json();
        console.log('反馈创建成功:', result);
        
        // 关闭模态框
        elements.newFeedbackModal.hide();
        
        // 重置表单
        elements.newFeedbackForm.reset();
        
        // 重新加载反馈列表
        await loadFeedbacks();
        
        // 选择新创建的反馈
        if (result.data && result.data.id) {
            selectFeedback(result.data.id);
        }
        
        showAlert('反馈创建成功', 'success');
    } catch (error) {
        console.error('创建反馈失败:', error);
        showAlert('创建反馈失败: ' + error.message, 'danger');
    }
}

// 更新反馈状态
function updateFeedbackStatus(feedbackId, newStatus) {
    const feedback = feedbackList.find(f => f.id === feedbackId);
    if (feedback) {
        feedback.status = newStatus;
        renderFeedbackList();
    }
}

// 更新未读消息计数
function updateUnreadCount(feedbackId) {
    // 如果不是当前选中的反馈，增加未读计数
    if (feedbackId !== currentFeedbackId) {
        const feedback = feedbackList.find(f => f.id === feedbackId);
        if (feedback) {
            feedback.unreadCount = (feedback.unreadCount || 0) + 1;
            renderFeedbackList();
        }
    }
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case CONFIG.FEEDBACK_STATUS.OPEN:
            return '待处理';
        case CONFIG.FEEDBACK_STATUS.IN_PROGRESS:
            return '处理中';
        case CONFIG.FEEDBACK_STATUS.RESOLVED:
            return '已解决';
        case CONFIG.FEEDBACK_STATUS.CLOSED:
            return '已关闭';
        default:
            return '未知状态';
    }
}

// 获取状态CSS类
function getStatusClass(status) {
    switch (status) {
        case CONFIG.FEEDBACK_STATUS.OPEN:
            return 'status-open';
        case CONFIG.FEEDBACK_STATUS.IN_PROGRESS:
            return 'status-in-progress';
        case CONFIG.FEEDBACK_STATUS.RESOLVED:
            return 'status-resolved';
        case CONFIG.FEEDBACK_STATUS.CLOSED:
            return 'status-closed';
        default:
            return 'bg-secondary';
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
}

// 格式化时间
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 显示提示信息
function showAlert(message, type = 'info') {
    // 创建提示元素
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // 添加到页面
    document.body.appendChild(alertDiv);
    
    // 3秒后自动关闭
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 3000);
}