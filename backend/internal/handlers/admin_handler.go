package handlers

import (
	"dataentry-platform/backend/internal/logger"
	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/models"
	"dataentry-platform/backend/internal/services"
	"dataentry-platform/backend/internal/utils"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AdminHandler struct {
	dataSvc  *services.DataService
	excelSvc *services.ExcelService
	authSvc  *services.AuthService
	db       *gorm.DB
}

func NewAdminHandler(dataSvc *services.DataService, excelSvc *services.ExcelService, authSvc *services.AuthService, db *gorm.DB) *AdminHandler {
	return &AdminHandler{dataSvc: dataSvc, excelSvc: excelSvc, authSvc: authSvc, db: db}
}

// ── User management ──────────────────────────────────────────────────────────

func (h *AdminHandler) CreateAdmin(c *gin.Context) {
	var body struct {
		Name     string  `json:"name" binding:"required"`
		Mobile   string  `json:"mobile" binding:"required"`
		Password string  `json:"password" binding:"required,min=6"`
		Email    *string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	user, err := h.authSvc.CreateAdmin(body.Name, body.Mobile, body.Password, body.Email)
	if err != nil {
		utils.Conflict(c, err.Error())
		return
	}
	actorID := GetUserIDFromContext(c)
	logger.Audit("admin_created", "New admin created: "+body.Mobile, actorID.String())
	utils.Created(c, user)
}

func (h *AdminHandler) ListAdmins(c *gin.Context) {
	var admins []models.User
	if err := h.db.Where("is_admin = ?", true).Order("created_at ASC").Find(&admins).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, admins)
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	db := h.db
	status := c.Query("status") // optional filter

	var users []models.User
	q := db.Where("is_admin = ?", false).Order("created_at DESC")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Find(&users).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, users)
}

func (h *AdminHandler) ApproveUser(c *gin.Context) {
	h.setUserStatus(c, models.UserStatusActive, true)
}

func (h *AdminHandler) DisableUser(c *gin.Context) {
	h.setUserStatus(c, models.UserStatusDisabled, false)
}

func (h *AdminHandler) EnableUser(c *gin.Context) {
	h.setUserStatus(c, models.UserStatusActive, false)
}

func (h *AdminHandler) setUserStatus(c *gin.Context, status models.UserStatus, isApproval bool) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}
	db := h.db

	updates := map[string]any{"status": status}
	if isApproval {
		claims := c.MustGet(middleware.UserKey).(*utils.Claims)
		approverID := claims.UserID
		updates["approved_by"] = approverID
		updates["approved_at"] = gorm.Expr("NOW()")
		updates["credential_valid_until"] = gorm.Expr("(NOW() + INTERVAL '365 days')::DATE")
	}

	if err := db.Model(&models.User{}).Where("id = ?", targetID).Updates(updates).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	actorID := GetUserIDFromContext(c)
	event := "user_status_changed"
	if isApproval {
		event = "user_approved"
	}
	logger.Audit(event, "User "+targetID.String()+" status set to "+string(status), actorID.String())
	utils.OK(c, gin.H{"message": "user status updated"})
}

func (h *AdminHandler) ResetPassword(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}

	var body struct {
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		utils.InternalError(c, "failed to hash password")
		return
	}

	db := h.db
	if err := db.Model(&models.User{}).Where("id = ?", targetID).
		Update("password_hash", string(hash)).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, gin.H{"message": "password reset successfully"})
}

func (h *AdminHandler) UserSessions(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}
	db := h.db

	var sessions []models.UserSession
	if err := db.Where("user_id = ?", targetID).
		Order("started_at DESC").Find(&sessions).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, sessions)
}

func (h *AdminHandler) UpdateUser(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}

	var body struct {
		DOB               *string `json:"dob"`
		Pincode           *string `json:"pincode"`
		State             *string `json:"state"`
		District          *string `json:"district"`
		Taluk             *string `json:"taluk"`
		ReferenceName     *string `json:"reference_name"`
		AccountHolderName *string `json:"account_holder_name"`
		BankName          *string `json:"bank_name"`
		AccountNumber     *string `json:"account_number"`
		IfscCode          *string `json:"ifsc_code"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	updates := map[string]any{}
	if body.DOB != nil {
		if *body.DOB == "" {
			updates["dob"] = nil
		} else {
			parsed, err := time.Parse("2006-01-02", *body.DOB)
			if err != nil {
				utils.BadRequest(c, "invalid dob format, expected YYYY-MM-DD")
				return
			}
			updates["dob"] = parsed
		}
	}
	if body.Pincode           != nil { updates["pincode"]              = *body.Pincode }
	if body.State             != nil { updates["state"]                = *body.State }
	if body.District          != nil { updates["district"]             = *body.District }
	if body.Taluk             != nil { updates["taluk"]                = *body.Taluk }
	if body.ReferenceName     != nil { updates["reference_name"]       = *body.ReferenceName }
	if body.AccountHolderName != nil { updates["account_holder_name"]  = *body.AccountHolderName }
	if body.BankName          != nil { updates["bank_name"]            = *body.BankName }
	if body.AccountNumber     != nil { updates["account_number"]       = *body.AccountNumber }
	if body.IfscCode          != nil { updates["ifsc_code"]            = *body.IfscCode }

	if len(updates) == 0 {
		utils.BadRequest(c, "no fields to update")
		return
	}

	if err := h.db.Model(&models.User{}).Where("id = ? AND is_admin = false", targetID).
		Updates(updates).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	var updated models.User
	h.db.First(&updated, "id = ?", targetID)
	actorID := GetUserIDFromContext(c)
	logger.Audit("user_profile_updated", "Profile updated for user "+targetID.String(), actorID.String())
	utils.OK(c, updated)
}

func (h *AdminHandler) TestPeriods(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ?", targetID).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}
	if user.ApprovedAt == nil {
		utils.OK(c, gin.H{"data": []any{}, "current_period": 0})
		return
	}

	type Period struct {
		Period       int    `json:"period"`
		Start        string `json:"start"`
		End          string `json:"end"`
		IsCurrent    bool   `json:"is_current"`
		DaysRemaining int   `json:"days_remaining"`
	}

	const periodDays = 40
	approvedAt := user.ApprovedAt.Truncate(24 * time.Hour)
	today := time.Now().Truncate(24 * time.Hour)

	daysSince := int(today.Sub(approvedAt).Hours() / 24)
	currentPeriod := daysSince/periodDays + 1

	var periods []Period
	for p := 1; p <= currentPeriod; p++ {
		start := approvedAt.AddDate(0, 0, (p-1)*periodDays)
		end   := approvedAt.AddDate(0, 0, p*periodDays-1)
		daysLeft := 0
		if p == currentPeriod {
			daysLeft = int(end.Sub(today).Hours()/24) + 1
		}
		periods = append(periods, Period{
			Period:        p,
			Start:         start.Format("2006-01-02"),
			End:           end.Format("2006-01-02"),
			IsCurrent:     p == currentPeriod,
			DaysRemaining: daysLeft,
		})
	}

	utils.OK(c, gin.H{"data": periods, "current_period": currentPeriod})
}

func (h *AdminHandler) ExtendValidity(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid user id")
		return
	}

	var body struct {
		ExtendDays int    `json:"extend_days"` // relative to current expiry (or today if none)
		ValidUntil string `json:"valid_until"`  // explicit YYYY-MM-DD date (overrides extend_days)
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	var user models.User
	if err := h.db.First(&user, "id = ? AND is_admin = false", targetID).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	var newDate time.Time
	if body.ValidUntil != "" {
		newDate, err = time.Parse("2006-01-02", body.ValidUntil)
		if err != nil {
			utils.BadRequest(c, "invalid valid_until format, expected YYYY-MM-DD")
			return
		}
	} else if body.ExtendDays > 0 {
		// Extend from current expiry (or today if no expiry set yet)
		base := time.Now().Truncate(24 * time.Hour)
		if user.CredentialValidUntil != nil && user.CredentialValidUntil.After(base) {
			base = *user.CredentialValidUntil
		}
		newDate = base.AddDate(0, 0, body.ExtendDays)
	} else {
		utils.BadRequest(c, "provide extend_days or valid_until")
		return
	}

	if err := h.db.Model(&models.User{}).Where("id = ?", targetID).
		Update("credential_valid_until", newDate).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	var updated models.User
	h.db.First(&updated, "id = ?", targetID)
	actorID := GetUserIDFromContext(c)
	logger.Audit("validity_extended", "Validity extended for "+targetID.String()+" until "+newDate.Format("2006-01-02"), actorID.String())
	utils.OK(c, updated)
}

// ── Batch management ─────────────────────────────────────────────────────────

func (h *AdminHandler) ListBatches(c *gin.Context) {
	db := h.db
	var batches []models.Batch
	if err := db.Order("uploaded_at DESC").Find(&batches).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, batches)
}

func (h *AdminHandler) DeleteBatch(c *gin.Context) {
	batchID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "Invalid batch id.")
		return
	}
	db := h.db

	// Guard: reject if any submissions reference records in this batch
	var subCount int64
	db.Model(&models.UserSubmission{}).
		Joins("JOIN data_records ON data_records.id = user_submissions.data_record_id").
		Where("data_records.batch_id = ?", batchID).
		Count(&subCount)
	if subCount > 0 {
		utils.Conflict(c, "Cannot delete batch: it has user submissions. Disable records instead.")
		return
	}

	// Delete records first (FK constraint), then the batch — in a transaction
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("batch_id = ?", batchID).Delete(&models.DataRecord{}).Error; err != nil {
			return err
		}
		if err := tx.Where("batch_id = ?", batchID).Delete(&models.FieldConfig{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", batchID).Delete(&models.Batch{}).Error
	}); err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, gin.H{"message": "Batch deleted successfully."})
}

// ── Record management ────────────────────────────────────────────────────────

func (h *AdminHandler) ListRecords(c *gin.Context) {
	db := h.db
	batchID := c.Query("batch_id")
	status := c.Query("status")

	var records []models.DataRecord
	q := db.Order("global_sequence ASC NULLS LAST, created_at ASC")
	if batchID != "" {
		q = q.Where("batch_id = ?", batchID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Find(&records).Error; err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, records)
}

func (h *AdminHandler) EnableRecord(c *gin.Context) {
	h.setRecordStatus(c, models.RecordStatusActive)
}

func (h *AdminHandler) DisableRecord(c *gin.Context) {
	h.setRecordStatus(c, models.RecordStatusDisabled)
}

func (h *AdminHandler) setRecordStatus(c *gin.Context, status models.RecordStatus) {
	recordID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid record id")
		return
	}
	db := h.db

	if err := db.Transaction(func(tx *gorm.DB) error {
		// When enabling: clear sequence first to avoid unique constraint collision
		if status == models.RecordStatusActive {
			if err := tx.Model(&models.DataRecord{}).Where("id = ?", recordID).
				Update("global_sequence", nil).Error; err != nil {
				return err
			}
		}
		// Update status
		if err := tx.Model(&models.DataRecord{}).Where("id = ?", recordID).
			Update("status", status).Error; err != nil {
			return err
		}
		// Re-sequence inside the same transaction
		return resequenceActiveRecords(tx)
	}); err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, gin.H{"message": "Record status updated and sequence adjusted."})
}

func (h *AdminHandler) DeleteRecord(c *gin.Context) {
	recordID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.BadRequest(c, "invalid record id")
		return
	}
	db := h.db

	var subCount int64
	db.Model(&models.UserSubmission{}).Where("data_record_id = ?", recordID).Count(&subCount)
	if subCount > 0 {
		utils.Conflict(c, "cannot delete record: it has user submissions")
		return
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ?", recordID).Delete(&models.DataRecord{}).Error; err != nil {
			return err
		}
		return resequenceActiveRecords(tx)
	}); err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, gin.H{"message": "Record deleted successfully."})
}

// resequenceActiveRecords assigns 1..N to all active records ordered by current sequence.
// Must be called inside an existing transaction (tx).
func resequenceActiveRecords(tx *gorm.DB) error {
	var records []models.DataRecord
	if err := tx.Where("status = ?", models.RecordStatusActive).
		Order("global_sequence ASC NULLS LAST, created_at ASC").
		Find(&records).Error; err != nil {
		return err
	}
	for i, rec := range records {
		seq := i + 1
		if err := tx.Model(&models.DataRecord{}).Where("id = ?", rec.ID).
			Update("global_sequence", seq).Error; err != nil {
			return err
		}
	}
	if err := tx.Exec("UPDATE sequence_counter SET next_val = ?", len(records)+1).Error; err != nil {
		return err
	}
	return nil
}

