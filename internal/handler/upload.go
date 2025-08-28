package handler

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UploadHandler 上传处理器
type UploadHandler struct{}

// NewUploadHandler 创建上传处理器
func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// UploadImage 上传图片
func (h *UploadHandler) UploadImage(c *gin.Context) {
	// 获取上传的文件
	file, header, err := c.Request.FormFile("image")
	if err != nil {
		BadRequest(c, "获取上传文件失败: "+err.Error())
		return
	}
	defer file.Close()

	// 验证文件类型
	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		BadRequest(c, "只能上传图片文件")
		return
	}

	// 验证文件大小 (5MB)
	if header.Size > 5*1024*1024 {
		BadRequest(c, "图片大小不能超过5MB")
		return
	}

	// 创建上传目录
	uploadDir := "./static/uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		ServerError(c, "创建上传目录失败: "+err.Error())
		return
	}

	// 生成唯一文件名
	ext := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)
	filepath := filepath.Join(uploadDir, filename)

	// 创建目标文件
	dst, err := os.Create(filepath)
	if err != nil {
		ServerError(c, "创建文件失败: "+err.Error())
		return
	}
	defer dst.Close()

	// 复制文件内容
	if _, err := io.Copy(dst, file); err != nil {
		ServerError(c, "保存文件失败: "+err.Error())
		return
	}

	// 返回文件URL
	fileURL := fmt.Sprintf("/static/uploads/%s", filename)
	Success(c, gin.H{
		"url":      fileURL,
		"filename": header.Filename,
		"size":     header.Size,
	})
}
