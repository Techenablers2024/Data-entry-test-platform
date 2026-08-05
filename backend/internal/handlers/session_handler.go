package handlers

import (
	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/services"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SessionHandler struct {
	sessionService *services.SessionService
}

func NewSessionHandler(svc *services.SessionService) *SessionHandler {
	return &SessionHandler{sessionService: svc}
}

func (h *SessionHandler) StartSession(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)

	var body struct {
		DeviceName *string `json:"device_name"`
	}
	_ = c.ShouldBindJSON(&body)

	deviceID := c.GetHeader("X-Device-ID")
	if deviceID == "" {
		utils.BadRequest(c, "X-Device-ID header is required")
		return
	}

	sess, err := h.sessionService.StartSession(services.StartSessionInput{
		UserID:     claims.UserID,
		DeviceID:   deviceID,
		DeviceName: body.DeviceName,
	})
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	utils.Created(c, sess)
}

func (h *SessionHandler) GetActiveSession(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)

	sess, err := h.sessionService.GetActiveSession(claims.UserID)
	if err != nil {
		utils.NotFound(c, "no active session")
		return
	}
	utils.OK(c, sess)
}

func (h *SessionHandler) TodaySummary(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)

	summary, err := h.sessionService.TodaySummary(claims.UserID)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, summary)
}

func (h *SessionHandler) Heartbeat(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid session id")
		return
	}

	deviceID := c.GetHeader("X-Device-ID")
	elapsed, remaining, err := h.sessionService.Heartbeat(sessionID, deviceID)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.OK(c, gin.H{
		"elapsed_seconds":   elapsed,
		"remaining_seconds": remaining,
	})
}

func (h *SessionHandler) Takeover(c *gin.Context) {
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid session id")
		return
	}

	// New device info from the request making the takeover
	newDeviceID := c.GetHeader("X-Device-ID")
	if newDeviceID == "" {
		utils.BadRequest(c, "X-Device-ID header is required")
		return
	}

	var body struct {
		DeviceName *string `json:"device_name"`
	}
	_ = c.ShouldBindJSON(&body)

	if err := h.sessionService.Takeover(sessionID, newDeviceID, body.DeviceName); err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, gin.H{"message": "Session transferred to this device successfully."})
}
