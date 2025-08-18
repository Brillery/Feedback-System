-- 改进后的反馈系统
-- 反馈表
CREATE TABLE feedbacks
(
    id           BIGINT UNSIGNED                         NOT NULL AUTO_INCREMENT COMMENT '反馈ID',
    title        VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '反馈标题',
    content      TEXT COLLATE utf8mb4_0900_ai_ci         NOT NULL COMMENT '反馈内容',
    contact      VARCHAR(100) COLLATE utf8mb4_bin                 DEFAULT NULL COMMENT '联系方式（手机/邮箱）',
    creator_id   BIGINT                                  NOT NULL COMMENT '创建者ID',
    creator_type TINYINT                                 NOT NULL COMMENT '创建者类型：1-用户 2-商家 3-管理员',
    target_id    BIGINT                                  NOT NULL COMMENT '目标ID（商家/管理员ID）',
    target_type  TINYINT                                 NOT NULL COMMENT '目标类型：1-商家 2-管理员',
    status       TINYINT                                 NOT NULL DEFAULT 1 COMMENT '状态：1-open 2-in_progress 3-resolved 4-closed',
    images       JSON                                             DEFAULT NULL COMMENT '初始反馈图片数组（JSON格式存储URL数组）',
    created_at   DATETIME                                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME                                NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_creator (creator_id, creator_type),
    INDEX idx_target (target_id, target_type),
    INDEX idx_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='反馈主题表';


-- 反馈处理记录表
CREATE TABLE feedback_messages
(
    id           BIGINT UNSIGNED                 NOT NULL AUTO_INCREMENT COMMENT '消息ID',
    feedback_id  BIGINT UNSIGNED                 NOT NULL COMMENT '关联反馈ID',
    sender_id    BIGINT UNSIGNED                 NOT NULL COMMENT '发送者ID',
    sender_type  TINYINT                         NOT NULL COMMENT '发送者类型：1-用户 2-商家 3-管理员',
    content_type TINYINT                         NOT NULL COMMENT '内容类型：1-文本 2-图片 3-图片数组',
    content      TEXT COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '消息内容（文本内容或JSON格式的图片URL数组）',
    is_read      TINYINT                         NOT NULL DEFAULT 0 COMMENT '是否已读：0-未读 1-已读',
    created_at   DATETIME                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_feedback (feedback_id),
    INDEX idx_sender (sender_id, sender_type)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4 COMMENT ='反馈消息表';

-- 为啥不在message加外键约束，外键feedback_id？
-- 出于性能考虑
-- 想要在删除feedback的时候，不会因为还有message关联着没删除，而导致的错误，当然去掉外键约束之后，
-- 我们要在代码层面，让删除feedback的时候，先删除message，避免孤立的messages占用空间

# 排序规则（COLLATE）只会影响字符的比较和排序逻辑，不会改变数据本身的存储内容，也不会修改你存入的实际值（包括 JSON 格式的图片 URL）。


# 原软秀的反馈表
CREATE TABLE `feedback` (
                            `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
                            `user_id` bigint unsigned NOT NULL COMMENT '反馈用户ID',
                            `title` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '反馈标题',
                            `contact` varchar(100) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '联系方式（手机号、微信号、邮箱等）',
                            `images` json NOT NULL COMMENT '图片数组',
                            `content` text COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '反馈内容',
                            `status` tinyint NOT NULL DEFAULT '0' COMMENT '处理状态：0=待处理，1=已处理',
                            `reply` text COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '管理员回复',
                            `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
                            `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
                            `type` tinyint unsigned NOT NULL DEFAULT '0' COMMENT '1-用户 2-商家 3-后台',
                            PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=60008 COMMENT='慧心家园_用户反馈表';

CREATE TABLE `feedback_reply` (
                                  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '回复id',
                                  `feedback_id` bigint unsigned NOT NULL COMMENT '反馈id',
                                  `type` tinyint unsigned NOT NULL COMMENT '1 文本 2 图片 3图片数组',
                                  `content` text COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '内容',
                                  `user_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT '用户id ',
                                  `admin_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'admin id  当admin回复时才有',
                                  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                  `merchant_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT '商家id',
                                  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=60010 COMMENT='反馈回复表';