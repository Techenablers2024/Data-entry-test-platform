package middleware

import (
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

// Device validates that the X-Device-ID header matches the device_id in the JWT claim.
// This prevents a stolen JWT from being used on a different device.
func Device() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := c.MustGet(UserKey).(*utils.Claims)
		if !ok {
			utils.Unauthorized(c, "Missing auth claims.")
			c.Abort()
			return
		}

		deviceID := c.GetHeader("X-Device-ID")
		if deviceID == "" {
			utils.BadRequest(c, "X-Device-ID header is required.")
			c.Abort()
			return
		}

		if claims.DeviceID != deviceID {
			utils.Forbidden(c, "Device mismatch: this token was issued for a different device.")
			c.Abort()
			return
		}

		c.Next()
	}
}
