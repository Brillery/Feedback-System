/**
 * 反馈系统 - 管理员端JavaScript
 */

// 全局变量
let currentUser = null;
let currentFeedbackId = null;
let wsConnection = null;
let feedbacks = [];
let typingTimeout = null;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化UI事件
    initUIEvents();
    
    // 检查登录状态
    checkLoginStatus();
});

/**
 * 初始化UI事件
 */
function initUIEvents() {
    // 登录按钮点击事件
    document.getElementById('loginBtn').addEventListener('click', () => {
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        loginModal.show();
    });

    // 登录表单提交事件
    document.getElementById('loginSubmitBtn').addEventListener('click', handleLogin);

    // 登出按钮点击事件
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 发送消息按钮点击事件
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);

    // 消息输入框回车事件
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // 消息输入框输入事件（用于发送正在输入状态）
    document.getElementById('messageInput').addEventListener('input', () => {
        if (!currentFeedbackId || !currentUser) return;
        
        // 清除之前的超时
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }
        
        // 发送正在输入状态
        sendTypingStatus(true);
        
        // 设置超时，2秒后发送停止输入状态
        typingTimeout = setTimeout(() => {
            sendTypingStatus(false);
        }, 2000);
    });

    // 状态更改下拉菜单点击事件
    document.querySelectorAll('.status-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentFeedbackId) return;
            
            const newStatus = e.target.getAttribute('data-status');
            updateFeedbackStatus(currentFeedbackId, newStatus);
        });
    });

    // 筛选下拉菜单点击事件
    document.querySelectorAll('.filter-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 更新活动状态
            document.querySelectorAll('.filter-item').forEach(i => {
                i.classList.remove('active');
            });
            e.target.classList.add('active');
            
            // 获取筛选值并应用筛选
            const filter = e.target.getAttribute('data-filter');
            applyFeedbackFilter(filter);
        });
    });

    // 删除反馈按钮点击事件
    document.getElementById('deleteFeedbackBtn').addEventListener('click', () => {
        if (!currentFeedbackId) return;
        
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        deleteModal.show();
    });

    // 确认删除按钮点击事件
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (!currentFeedbackId) return;
        
        deleteFeedback(currentFeedbackId);
        bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal')).hide();
    });
}

/**
 * 检查登录状态
 */
function checkLoginStatus() {
    const userData = localStorage.getItem('adminUser');
    const token = localStorage.getItem('token');
    
    if (userData && token) {
        try {
            currentUser = JSON.parse(userData);
            
            // 设置请求头中的Authorization
            setAuthHeader(token);
            
            // 验证令牌有效性
            fetch(API_ENDPOINTS.USER.CURRENT, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (response.ok) {
                    updateUIForLoggedInUser();
                    loadAllFeedbacks();
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
        } catch (e) {
            console.error('登录状态解析失败:', e);
            localStorage.removeItem('adminUser');
            localStorage.removeItem('token');
        }
    }
}

/**
 * 设置请求头中的Authorization
 */
function setAuthHeader(token) {
    // 保存原始的fetch函数
    window.originalFetch = window.fetch;
    
    // 为后续的fetch请求添加拦截器，自动添加Authorization头
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

/**
 * 处理登录
 */
function handleLogin() {
    const username = elements.loginUsername.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!username || !password) {
        alert('请输入用户名和密码');
        return;
    }
    
    // 构建登录请求数据
    const loginData = {
        username: username,
        password: password,
        user_type: CONFIG.USER_TYPE.ADMIN
    };
    
    // 发送登录请求
    fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.USER.LOGIN}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.code === 0) {
            // 登录成功
            currentUser = data.data.user;
            
            // 保存登录状态和令牌
            localStorage.setItem('adminUser', JSON.stringify(currentUser));
            localStorage.setItem('token', data.data.token);
            
            // 设置请求头中的Authorization
            setAuthHeader(data.data.token);
            
            // 更新UI
            updateUIForLoggedInUser();
            
            // 加载反馈列表
            loadAllFeedbacks();
            
            // 连接WebSocket
            connectWebSocket();
            
            // 关闭登录模态框
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        } else {
            // 登录失败
            alert('登录失败: ' + data.message);
        }
    })
    .catch(error => {
        console.error('登录请求失败:', error);
        alert('登录请求失败，请检查网络连接');
    });
}

/**
 * 处理登出
 */
function handleLogout() {
    // 关闭WebSocket连接
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
    
    // 清除登录状态和令牌
    localStorage.removeItem('adminUser');
    localStorage.removeItem('token');
    currentUser = null;
    currentFeedbackId = null;
    
    // 恢复原始的fetch函数
    if (window.originalFetch) {
        window.fetch = window.originalFetch;
        window.originalFetch = null;
    }
    
    // 更新UI
    updateUIForLoggedOutUser();
}

/**
 * 更新已登录用户的UI
 */
function updateUIForLoggedInUser() {
    document.getElementById('username').textContent = currentUser.username;
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
}

/**
 * 更新已登出用户的UI
 */
function updateUIForLoggedOutUser() {
    document.getElementById('username').textContent = '未登录';
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('feedbackList').innerHTML = '';
    document.getElementById('chatContainer').innerHTML = `
        <div class="text-center text-muted my-5" id="noChatSelected">
            <p>请登录后查看反馈</p>
        </div>
    `;
    document.getElementById('currentFeedbackTitle').textContent = '请选择一个反馈';
    document.getElementById('currentFeedbackStatus').textContent = '';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('messageInputArea').style.display = 'none';
    
    // 重置统计数据
    document.getElementById('totalFeedbacks').textContent = '0';
    document.getElementById('openFeedbacks').textContent = '0';
    document.getElementById('inProgressFeedbacks').textContent = '0';
    document.getElementById('resolvedFeedbacks').textContent = '0';
}

/**
 * 连接WebSocket
 */
function connectWebSocket() {
    if (!currentUser) return;
    
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('WebSocket连接失败: 未找到令牌');
        return;
    }
    
    // 在WebSocket连接URL中包含令牌
    wsConnection = new WebSocket(`${WS_URL}?userId=${currentUser.id}&userType=${currentUser.type}&username=${currentUser.username}&token=${token}`);
    
    wsConnection.onopen = () => {
        console.log('WebSocket连接已建立');
    };
    
    wsConnection.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
    };
    
    wsConnection.onclose = (event) => {
        console.log('WebSocket连接已关闭', event.code, event.reason);
        
        // 如果是认证失败导致的关闭（错误码1008）
        if (event.code === 1008) {
            alert('认证失败，请重新登录');
            handleLogout();
        }
        // 可以在这里添加重连逻辑
    };
    
    wsConnection.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };
}

/**
 * 处理WebSocket消息
 */
function handleWebSocketMessage(message) {
    switch (message.type) {
        case WS_MESSAGE_TYPE.NEW_MESSAGE:
            // 如果是当前查看的反馈，则添加消息
            if (message.feedbackId === currentFeedbackId) {
                addMessageToChat(message.data);
                // 标记为已读
                markMessageAsRead(message.data.id);
            }
            // 更新反馈列表中的未读消息计数
            updateUnreadCountInList(message.feedbackId);
            break;
            
        case WS_MESSAGE_TYPE.TYPING:
            // 如果是当前查看的反馈，则显示正在输入状态
            if (message.feedbackId === currentFeedbackId) {
                showTypingIndicator(message.data.isTyping, message.data.username);
            }
            break;
            
        case WS_MESSAGE_TYPE.READ:
            // 更新消息的已读状态
            updateMessageReadStatus(message.data.messageId);
            break;
            
        case WS_MESSAGE_TYPE.STATUS_CHANGE:
            // 更新反馈状态
            updateFeedbackStatusInList(message.feedbackId, message.data.status);
            // 如果是当前查看的反馈，则更新状态显示
            if (message.feedbackId === currentFeedbackId) {
                document.getElementById('currentFeedbackStatus').textContent = getStatusText(message.data.status);
                // 添加系统消息
                addSystemMessageToChat(`反馈状态已更新为: ${getStatusText(message.data.status)}`);
            }
            // 更新统计数据
            updateStatistics();
            break;
            
        case WS_MESSAGE_TYPE.NEW_FEEDBACK:
            // 添加新反馈到列表
            loadAllFeedbacks();
            // 更新统计数据
            updateStatistics();
            break;
            
        case WS_MESSAGE_TYPE.DELETE_FEEDBACK:
            // 从列表中移除反馈
            removeFeedbackFromList(message.feedbackId);
            // 如果是当前查看的反馈，则清空聊天区域
            if (message.feedbackId === currentFeedbackId) {
                currentFeedbackId = null;
                document.getElementById('chatContainer').innerHTML = `
                    <div class="text-center text-muted my-5" id="noChatSelected">
                        <p>请从左侧选择一个反馈</p>
                    </div>
                `;
                document.getElementById('currentFeedbackTitle').textContent = '请选择一个反馈';
                document.getElementById('currentFeedbackStatus').textContent = '';
                document.getElementById('actionButtons').style.display = 'none';
                document.getElementById('messageInputArea').style.display = 'none';
            }
            // 更新统计数据
            updateStatistics();
            break;
    }
}

/**
 * 加载所有反馈
 */
function loadAllFeedbacks() {
    if (!currentUser) return;
    
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        alert('登录已过期，请重新登录');
        handleLogout();
        return;
    }
    
    fetch(API_ENDPOINTS.FEEDBACK.GET_ALL, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (response.status === 401) {
                // 未授权，可能是令牌过期
                alert('登录已过期，请重新登录');
                handleLogout();
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.code === 0) {
                feedbacks = data.data;
                renderFeedbackList(feedbacks);
                updateStatistics();
            } else if (data) {
                console.error('加载反馈失败:', data.message);
            }
        })
        .catch(error => {
            console.error('加载反馈请求失败:', error);
        });
}

/**
 * 渲染反馈列表
 */
function renderFeedbackList(feedbackList) {
    const listContainer = document.getElementById('feedbackList');
    listContainer.innerHTML = '';
    
    if (feedbackList.length === 0) {
        listContainer.innerHTML = `
            <div class="list-group-item text-center text-muted">
                <p>暂无反馈</p>
            </div>
        `;
        return;
    }
    
    feedbackList.forEach(feedback => {
        const listItem = document.createElement('a');
        listItem.href = '#';
        listItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        listItem.setAttribute('data-id', feedback.id);
        listItem.setAttribute('data-status', feedback.status);
        
        // 如果是当前选中的反馈，添加active类
        if (feedback.id === currentFeedbackId) {
            listItem.classList.add('active');
        }
        
        // 构建未读消息徽章
        const unreadBadge = feedback.unread_count > 0 ? 
            `<span class="badge bg-primary rounded-pill">${feedback.unread_count}</span>` : '';
        
        // 构建状态标签
        const statusClass = getStatusClass(feedback.status);
        const statusText = getStatusText(feedback.status);
        
        listItem.innerHTML = `
            <div>
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${feedback.title}</h6>
                </div>
                <small class="text-muted">用户: ${feedback.username}</small>
                <div>
                    <span class="badge ${statusClass}">${statusText}</span>
                    <small class="text-muted">${formatDate(feedback.created_at)}</small>
                </div>
            </div>
            ${unreadBadge}
        `;
        
        // 添加点击事件
        listItem.addEventListener('click', () => {
            selectFeedback(feedback.id);
        });
        
        listContainer.appendChild(listItem);
    });
}

/**
 * 应用反馈筛选
 */
function applyFeedbackFilter(filter) {
    if (filter === 'all') {
        renderFeedbackList(feedbacks);
    } else {
        const filteredFeedbacks = feedbacks.filter(feedback => feedback.status === filter);
        renderFeedbackList(filteredFeedbacks);
    }
}

/**
 * 选择反馈
 */
function selectFeedback(feedbackId) {
    // 更新当前选中的反馈ID
    currentFeedbackId = feedbackId;
    
    // 更新列表项的active状态
    document.querySelectorAll('#feedbackList a').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-id') === feedbackId) {
            item.classList.add('active');
        }
    });
    
    // 查找当前反馈对象
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (!feedback) return;
    
    // 更新反馈标题和状态
    document.getElementById('currentFeedbackTitle').textContent = feedback.title;
    document.getElementById('currentFeedbackStatus').textContent = getStatusText(feedback.status);
    
    // 显示操作按钮和消息输入区域
    document.getElementById('actionButtons').style.display = 'flex';
    document.getElementById('messageInputArea').style.display = 'block';
    
    // 加载反馈消息
    loadFeedbackMessages(feedbackId);
}

/**
 * 加载反馈消息
 */
function loadFeedbackMessages(feedbackId) {
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        alert('登录已过期，请重新登录');
        handleLogout();
        return;
    }
    
    fetch(`${API_ENDPOINTS.FEEDBACK_MESSAGE.GET_BY_FEEDBACK_ID}?feedbackId=${feedbackId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (response.status === 401) {
                // 未授权，可能是令牌过期
                alert('登录已过期，请重新登录');
                handleLogout();
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.code === 0) {
                renderChatMessages(data.data);
                // 标记所有消息为已读
                markAllMessagesAsRead(feedbackId);
            } else if (data) {
                console.error('加载消息失败:', data.message);
            }
        })
        .catch(error => {
            console.error('加载消息请求失败:', error);
        });
}

/**
 * 渲染聊天消息
 */
function renderChatMessages(messages) {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';
    
    if (messages.length === 0) {
        chatContainer.innerHTML = `
            <div class="text-center text-muted my-5">
                <p>暂无消息</p>
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        chatContainer.appendChild(messageElement);
    });
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * 创建消息元素
 */
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    
    // 根据消息类型设置不同的样式
    if (message.message_type === 'system') {
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${message.content}</p>
                <div class="message-meta">
                    <small>${formatDateTime(message.created_at)}</small>
                </div>
            </div>
        `;
    } else {
        // 判断是否是当前用户发送的消息
        const isSelf = message.user_type === USER_TYPE.ADMIN;
        messageDiv.className = `message ${isSelf ? 'sender-message' : 'receiver-message'}`;
        
        // 设置已读标记
        const readStatus = message.is_read ? 
            '<small class="text-muted read-status">已读</small>' : 
            '<small class="text-muted read-status">未读</small>';
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <strong>${message.username}</strong>
                    <small class="text-muted">${getUserTypeText(message.user_type)}</small>
                </div>
                <p>${message.content}</p>
                <div class="message-meta">
                    <small>${formatDateTime(message.created_at)}</small>
                    ${isSelf ? readStatus : ''}
                </div>
            </div>
        `;
        
        // 为消息元素添加data属性，用于更新已读状态
        messageDiv.setAttribute('data-message-id', message.id);
    }
    
    return messageDiv;
}

/**
 * 添加消息到聊天区域
 */
function addMessageToChat(message) {
    const chatContainer = document.getElementById('chatContainer');
    
    // 如果是第一条消息，清空"暂无消息"提示
    if (chatContainer.querySelector('.text-center.text-muted')) {
        chatContainer.innerHTML = '';
    }
    
    const messageElement = createMessageElement(message);
    chatContainer.appendChild(messageElement);
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * 添加系统消息到聊天区域
 */
function addSystemMessageToChat(content) {
    const chatContainer = document.getElementById('chatContainer');
    
    // 如果是第一条消息，清空"暂无消息"提示
    if (chatContainer.querySelector('.text-center.text-muted')) {
        chatContainer.innerHTML = '';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${content}</p>
            <div class="message-meta">
                <small>${formatDateTime(new Date())}</small>
            </div>
        </div>
    `;
    
    chatContainer.appendChild(messageDiv);
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * 发送消息
 */
function sendMessage() {
    if (!currentUser || !currentFeedbackId) return;
    
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content) return;
    
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        alert('登录已过期，请重新登录');
        handleLogout();
        return;
    }
    
    // 构建消息对象
    const messageData = {
        feedback_id: currentFeedbackId,
        content: content,
        user_id: currentUser.id,
        username: currentUser.username,
        user_type: currentUser.type
    };
    
    // 发送消息到服务器
    fetch(API_ENDPOINTS.FEEDBACK_MESSAGE.CREATE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(messageData)
    })
        .then(response => {
            if (response.status === 401) {
                // 未授权，可能是令牌过期
                alert('登录已过期，请重新登录');
                handleLogout();
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.code === 0) {
                // 清空输入框
                messageInput.value = '';
                // 停止输入状态
                sendTypingStatus(false);
            } else if (data) {
                console.error('发送消息失败:', data.message);
                alert('发送消息失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('发送消息请求失败:', error);
            alert('发送消息请求失败，请检查网络连接');
        });
}

/**
 * 发送正在输入状态
 */
function sendTypingStatus(isTyping) {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN || !currentUser || !currentFeedbackId) {
        return;
    }
    
    const typingMessage = {
        type: WS_MESSAGE_TYPE.TYPING,
        feedbackId: currentFeedbackId,
        data: {
            userId: currentUser.id,
            username: currentUser.username,
            isTyping: isTyping
        }
    };
    
    wsConnection.send(JSON.stringify(typingMessage));
}

/**
 * 显示正在输入指示器
 */
function showTypingIndicator(isTyping, username) {
    const typingIndicator = document.getElementById('typingIndicator');
    
    if (isTyping) {
        typingIndicator.textContent = `${username} 正在输入...`;
    } else {
        typingIndicator.textContent = '';
    }
}

/**
 * 标记消息为已读
 */
function markMessageAsRead(messageId) {
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('标记消息已读失败: 未找到令牌');
        return;
    }
    
    fetch(`${API_ENDPOINTS.FEEDBACK_MESSAGE.MARK_AS_READ}?messageId=${messageId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (response.status === 401) {
                // 未授权，可能是令牌过期
                console.error('标记消息已读失败: 认证失败');
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.code !== 0) {
                console.error('标记消息已读失败:', data.message);
            }
        })
        .catch(error => {
            console.error('标记消息已读请求失败:', error);
        });
}

/**
 * 标记所有消息为已读
 */
function markAllMessagesAsRead(feedbackId) {
    // 更新反馈列表中的未读计数
    const listItem = document.querySelector(`#feedbackList a[data-id="${feedbackId}"]`);
    if (listItem) {
        const badge = listItem.querySelector('.badge');
        if (badge) {
            badge.remove();
        }
    }
    
    // 更新反馈对象中的未读计数
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (feedback) {
        feedback.unread_count = 0;
    }
}

/**
 * 更新消息的已读状态
 */
function updateMessageReadStatus(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const readStatus = messageElement.querySelector('.read-status');
        if (readStatus) {
            readStatus.textContent = '已读';
        }
    }
}

/**
 * 更新反馈列表中的未读消息计数
 */
function updateUnreadCountInList(feedbackId) {
    // 查找反馈对象
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (!feedback) return;
    
    // 如果不是当前查看的反馈，增加未读计数
    if (feedbackId !== currentFeedbackId) {
        feedback.unread_count = (feedback.unread_count || 0) + 1;
        
        // 更新列表项中的未读徽章
        const listItem = document.querySelector(`#feedbackList a[data-id="${feedbackId}"]`);
        if (listItem) {
            let badge = listItem.querySelector('.badge');
            if (badge) {
                badge.textContent = feedback.unread_count;
            } else {
                badge = document.createElement('span');
                badge.className = 'badge bg-primary rounded-pill';
                badge.textContent = feedback.unread_count;
                listItem.appendChild(badge);
            }
        }
    }
}

/**
 * 更新反馈状态
 */
function updateFeedbackStatus(feedbackId, newStatus) {
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        alert('登录已过期，请重新登录');
        handleLogout();
        return;
    }
    
    fetch(`${API_ENDPOINTS.FEEDBACK.UPDATE_STATUS}?feedbackId=${feedbackId}&status=${newStatus}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (response.status === 401) {
                // 未授权，可能是令牌过期
                alert('登录已过期，请重新登录');
                handleLogout();
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.code !== 0) {
                console.error('更新反馈状态失败:', data.message);
                alert('更新反馈状态失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('更新反馈状态请求失败:', error);
            alert('更新反馈状态请求失败，请检查网络连接');
        });
}

/**
 * 更新反馈列表中的状态
 */
function updateFeedbackStatusInList(feedbackId, newStatus) {
    // 更新反馈对象
    const feedback = feedbacks.find(f => f.id === feedbackId);
    if (feedback) {
        feedback.status = newStatus;
    }
    
    // 更新列表项
    const listItem = document.querySelector(`#feedbackList a[data-id="${feedbackId}"]`);
    if (listItem) {
        listItem.setAttribute('data-status', newStatus);
        
        // 更新状态标签
        const statusBadge = listItem.querySelector('.badge:not(.rounded-pill)');
        if (statusBadge) {
            statusBadge.className = `badge ${getStatusClass(newStatus)}`;
            statusBadge.textContent = getStatusText(newStatus);
        }
    }
}

/**
 * 删除反馈
 */
function deleteFeedback(feedbackId) {
    // 获取令牌
    const token = localStorage.getItem('token');
    if (!token) {
        alert('登录已过期，请重新登录');
        handleLogout();
        return;
    }
    
    fetch(`${API_ENDPOINTS.FEEDBACK.DELETE}?feedbackId=${feedbackId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (response.status === 401) {
                // 未授权，可能是令牌过期
                alert('登录已过期，请重新登录');
                handleLogout();
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data && data.code === 0) {
                // 从列表中移除反馈
                removeFeedbackFromList(feedbackId);
                
                // 如果是当前查看的反馈，则清空聊天区域
                if (feedbackId === currentFeedbackId) {
                    currentFeedbackId = null;
                    document.getElementById('chatContainer').innerHTML = `
                        <div class="text-center text-muted my-5" id="noChatSelected">
                            <p>请从左侧选择一个反馈</p>
                        </div>
                    `;
                    document.getElementById('currentFeedbackTitle').textContent = '请选择一个反馈';
                    document.getElementById('currentFeedbackStatus').textContent = '';
                    document.getElementById('actionButtons').style.display = 'none';
                    document.getElementById('messageInputArea').style.display = 'none';
                }
                
                // 更新统计数据
                updateStatistics();
            } else if (data) {
                console.error('删除反馈失败:', data.message);
                alert('删除反馈失败: ' + data.message);
            }
        })
        .catch(error => {
            console.error('删除反馈请求失败:', error);
            alert('删除反馈请求失败，请检查网络连接');
        });
}

/**
 * 从列表中移除反馈
 */
function removeFeedbackFromList(feedbackId) {
    // 从数组中移除
    feedbacks = feedbacks.filter(f => f.id !== feedbackId);
    
    // 从DOM中移除
    const listItem = document.querySelector(`#feedbackList a[data-id="${feedbackId}"]`);
    if (listItem) {
        listItem.remove();
    }
    
    // 如果列表为空，显示提示
    if (feedbacks.length === 0) {
        document.getElementById('feedbackList').innerHTML = `
            <div class="list-group-item text-center text-muted">
                <p>暂无反馈</p>
            </div>
        `;
    }
}

/**
 * 更新统计数据
 */
function updateStatistics() {
    // 总反馈数
    document.getElementById('totalFeedbacks').textContent = feedbacks.length;
    
    // 待处理反馈数
    const openCount = feedbacks.filter(f => f.status === 'open').length;
    document.getElementById('openFeedbacks').textContent = openCount;
    
    // 处理中反馈数
    const inProgressCount = feedbacks.filter(f => f.status === 'in_progress').length;
    document.getElementById('inProgressFeedbacks').textContent = inProgressCount;
    
    // 已解决反馈数
    const resolvedCount = feedbacks.filter(f => f.status === 'resolved').length;
    document.getElementById('resolvedFeedbacks').textContent = resolvedCount;
}

/**
 * 获取状态对应的CSS类
 */
function getStatusClass(status) {
    switch (status) {
        case 'open':
            return 'bg-warning text-dark';
        case 'in_progress':
            return 'bg-info text-dark';
        case 'resolved':
            return 'bg-success';
        case 'closed':
            return 'bg-secondary';
        default:
            return 'bg-secondary';
    }
}

/**
 * 获取状态文本
 */
function getStatusText(status) {
    switch (status) {
        case 'open':
            return '待处理';
        case 'in_progress':
            return '处理中';
        case 'resolved':
            return '已解决';
        case 'closed':
            return '已关闭';
        default:
            return '未知状态';
    }
}

/**
 * 获取用户类型文本
 */
function getUserTypeText(userType) {
    switch (userType) {
        case USER_TYPE.USER:
            return '用户';
        case USER_TYPE.MERCHANT:
            return '商家';
        case USER_TYPE.ADMIN:
            return '管理员';
        default:
            return '未知';
    }
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

/**
 * 数字补零
 */
function padZero(num) {
    return num < 10 ? '0' + num : num;
}