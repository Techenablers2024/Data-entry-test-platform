package middleware

import (
	"strings"
	"time"

	"dataentry-platform/backend/internal/logger"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		// Skip high-volume no-diagnostic-value endpoints
		if strings.HasSuffix(path, "/heartbeat") ||
			path == "/logs" || path == "/logs/ui" || path == "/logs/stats" ||
			path == "/health" {
			c.Next()
			return
		}
		start := time.Now()
		c.Next()
		latency := time.Since(start)

		userID := ""
		if claims, ok := c.Get(UserKey); ok {
			if cl, ok := claims.(*utils.Claims); ok {
				userID = cl.UserID.String()
			}
		}

		entry := logger.Entry{
			Level:   logger.LevelInfo,
			Event:   "request",
			Method:  c.Request.Method,
			Path:    c.Request.URL.Path,
			Status:  c.Writer.Status(),
			Latency: latency.Round(time.Millisecond).String(),
			UserID:  userID,
		}
		if c.Writer.Status() >= 400 {
			entry.Level = logger.LevelError
			entry.Error = c.Errors.String()
		}
		logger.Write(entry)
	}
}
