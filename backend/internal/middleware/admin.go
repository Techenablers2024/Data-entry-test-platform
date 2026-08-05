package middleware

import (
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := c.MustGet(UserKey).(*utils.Claims)
		if !ok || !claims.IsAdmin {
			utils.Forbidden(c, "Admin access required.")
			c.Abort()
			return
		}
		c.Next()
	}
}
