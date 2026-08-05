package middleware

import (
	"strings"

	"dataentry-platform/backend/internal/config"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

const UserKey = "user_claims"

func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			utils.Unauthorized(c, "Missing or invalid authorization header.")
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := utils.ParseToken(tokenStr, cfg.JWTSecret)
		if err != nil {
			utils.Unauthorized(c, "Invalid or expired token.")
			c.Abort()
			return
		}

		c.Set(UserKey, claims)
		c.Next()
	}
}
