package handlers

import (
	"io"

	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/services"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DataHandler struct {
	dataService  *services.DataService
	excelService *services.ExcelService
}

func NewDataHandler(dataSvc *services.DataService, excelSvc *services.ExcelService) *DataHandler {
	return &DataHandler{dataService: dataSvc, excelService: excelSvc}
}

func (h *DataHandler) Progress(c *gin.Context) {
	userID := GetUserIDFromContext(c)
	result, err := h.dataService.GetProgress(userID)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, result)
}

func (h *DataHandler) NextRecord(c *gin.Context) {
	userID := GetUserIDFromContext(c)
	result, err := h.dataService.NextRecord(userID)
	if err != nil {
		utils.NotFound(c, err.Error())
		return
	}
	utils.OK(c, result)
}

func (h *DataHandler) GetRecord(c *gin.Context) {
	recordID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid record id")
		return
	}
	result, err := h.dataService.GetRecord(recordID)
	if err != nil {
		utils.NotFound(c, "record not found")
		return
	}
	utils.OK(c, result)
}

func (h *DataHandler) SubmitRecord(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)

	recordID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid record id")
		return
	}

	var body struct {
		SessionID   string            `json:"session_id" binding:"required"`
		InputValues map[string]string `json:"input_values" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	sessionID, err := uuid.Parse(body.SessionID)
	if err != nil {
		utils.BadRequest(c, "invalid session_id")
		return
	}

	sub, err := h.dataService.Submit(services.SubmitInput{
		UserID:      claims.UserID,
		RecordID:    recordID,
		SessionID:   sessionID,
		InputValues: body.InputValues,
	})
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	utils.Created(c, sub)
}

// UploadBatch handles Excel file uploads (admin only — also used by admin handler).
func (h *DataHandler) UploadBatch(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.BadRequest(c, "file is required (multipart field: 'file')")
		return
	}
	defer file.Close()

	if header.Size > 10*1024*1024 {
		utils.BadRequest(c, "file too large: max 10 MB")
		return
	}

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		utils.InternalError(c, "failed to read uploaded file")
		return
	}

	result, err := h.excelService.ParseAndStore(header.Filename, fileBytes, claims.UserID)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	utils.Created(c, result)
}
