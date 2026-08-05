package handlers

import (
	"strconv"

	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/services"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReportHandler struct {
	dataSvc *services.DataService
}

func NewReportHandler(dataSvc *services.DataService) *ReportHandler {
	return &ReportHandler{dataSvc: dataSvc}
}

func parsePage(c *gin.Context) (int, int) {
	page, err := strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if err != nil || limit < 1 || limit > 200 {
		limit = 50
	}
	return page, limit
}

// MyReport — user views their own report
func (h *ReportHandler) MyReport(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)
	page, limit := parsePage(c)
	report, err := h.dataSvc.GetUserReport(claims.UserID, page, limit)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, report)
}

// AdminUserReport — admin views any user's report
func (h *ReportHandler) AdminUserReport(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}
	page, limit := parsePage(c)
	report, err := h.dataSvc.GetUserReport(userID, page, limit)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, report)
}
