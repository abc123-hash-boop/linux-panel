package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

/*
 * ============================================================
 * POST /api/file/upload
 *
 * 支持单文件和多文件上传，target 参数指定目标目录（默认 /）
 * ============================================================
 */

func FileUpload(c *gin.Context) {

	targetDir := c.PostForm("target")
	if targetDir == "" {
		targetDir = "/"
	}
	targetDir, _ = cleanFilePath(targetDir)

	// 尝试单文件
	file, header, err := c.Request.FormFile("file")
	if err == nil {
		defer file.Close()
		baseName := filepath.Base(header.Filename)
		dstPath := filepath.Join(targetDir, baseName)
		dstPath, _ = cleanFilePath(dstPath)

		if saveErr := saveUploadedFile(file, dstPath); saveErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": saveErr.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"uploaded": []string{baseName}})
		return
	}

	// 尝试多文件：先 Parse，再取 MultipartForm
	const maxMemory = 32 << 20 // 32 MB
	if err := c.Request.ParseMultipartForm(maxMemory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file uploaded"})
		return
	}

	form := c.Request.MultipartForm
	if form == nil || len(form.File) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file uploaded"})
		return
	}

	uploaded := make([]string, 0)
	for _, fhList := range form.File {
		for _, fh := range fhList {
			src, openErr := fh.Open()
			if openErr != nil {
				continue
			}
			baseName := filepath.Base(fh.Filename)
			dstPath := filepath.Join(targetDir, baseName)
			dstPath, _ = cleanFilePath(dstPath)

			if saveErr := saveUploadedFile(src, dstPath); saveErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": saveErr.Error()})
				src.Close()
				return
			}
			src.Close()
			uploaded = append(uploaded, baseName)
		}
	}

	c.JSON(http.StatusOK, gin.H{"uploaded": uploaded})
}

func saveUploadedFile(src io.Reader, dstPath string) error {
	parent := filepath.Dir(dstPath)
	if err := os.MkdirAll(parent, 0755); err != nil {
		return fmt.Errorf("mkdir failed: %w", err)
	}

	dst, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("create failed: %w", err)
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	return err
}
