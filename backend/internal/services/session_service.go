package services

import (
	"errors"
	"time"

	"dataentry-platform/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IST is the authoritative timezone for session day boundaries.
var IST = mustLoadLocation("Asia/Kolkata")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic("failed to load timezone: " + name)
	}
	return loc
}

// todayIST returns the current calendar date in IST as a time.Time (midnight).
func todayIST() time.Time {
	now := time.Now().In(IST)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, IST)
}

type SessionService struct {
	db *gorm.DB
}

func NewSessionService(db *gorm.DB) *SessionService {
	return &SessionService{db: db}
}

type StartSessionInput struct {
	UserID     uuid.UUID
	DeviceID   string
	DeviceName *string
}

type TodaySummary struct {
	SessionsUsed    int64 `json:"sessions_used"`
	TotalElapsed    int   `json:"total_elapsed_seconds"`
	RemainingDaily  int   `json:"remaining_daily_seconds"`
	SessionsAllowed int   `json:"sessions_allowed"`
}

// TodaySummary returns how many sessions the user has used and total elapsed today.
func (s *SessionService) TodaySummary(userID uuid.UUID) (*TodaySummary, error) {
	today := todayIST()

	var sessions []models.UserSession
	if err := s.db.Where("user_id = ? AND session_date = ?", userID, today.Format("2006-01-02")).
		Find(&sessions).Error; err != nil {
		return nil, err
	}

	var totalElapsed int
	for _, sess := range sessions {
		if sess.Status == models.SessionStatusActive {
			// Compute live elapsed for the running session
			elapsed := int(time.Since(sess.StartedAt).Seconds())
			totalElapsed += elapsed
		} else {
			totalElapsed += sess.ElapsedSeconds
		}
	}
	if totalElapsed > models.MaxDailySeconds {
		totalElapsed = models.MaxDailySeconds
	}

	remainingByQuota := models.MaxDailySeconds - totalElapsed

	// Cap by time until midnight IST — user can't use more time than what's left today
	todayDate := todayIST()
	midnight := time.Date(todayDate.Year(), todayDate.Month(), todayDate.Day()+1, 0, 0, 0, 0, IST)
	secondsUntilMidnight := int(time.Until(midnight).Seconds())
	if secondsUntilMidnight < 0 {
		secondsUntilMidnight = 0
	}

	remainingDaily := remainingByQuota
	if secondsUntilMidnight < remainingDaily {
		remainingDaily = secondsUntilMidnight
	}

	return &TodaySummary{
		SessionsUsed:    int64(len(sessions)),
		TotalElapsed:    totalElapsed,
		RemainingDaily:  remainingDaily,
		SessionsAllowed: models.MaxSessionsPerDay,
	}, nil
}

// StartSession creates a new session after validating all quota and device rules.
func (s *SessionService) StartSession(input StartSessionInput) (*models.UserSession, error) {
	today := todayIST()
	todayStr := today.Format("2006-01-02")

	var existing []models.UserSession
	if err := s.db.Where("user_id = ? AND session_date = ?", input.UserID, todayStr).
		Find(&existing).Error; err != nil {
		return nil, err
	}

	// Check session count quota
	if len(existing) >= models.MaxSessionsPerDay {
		return nil, errors.New("Daily session limit reached (2 sessions per day).")
	}

	// Check daily time quota
	var totalElapsed int
	for _, sess := range existing {
		totalElapsed += sess.ElapsedSeconds
	}
	if totalElapsed >= models.MaxDailySeconds {
		return nil, errors.New("Daily time limit of 8 hours reached.")
	}

	// Check no other active session exists (the DB unique index also enforces this)
	for _, sess := range existing {
		if sess.Status == models.SessionStatusActive {
			if sess.DeviceID == input.DeviceID {
				// Same device — return the existing active session
				return &sess, nil
			}
			return nil, errors.New("Another session is active on a different device. Use takeover to switch.")
		}
	}

	// Warn if starting session near midnight (less than full 4 hrs left today)
	midnight := time.Date(today.Year(), today.Month(), today.Day()+1, 0, 0, 0, 0, IST)
	secondsUntilMidnight := int(time.Until(midnight).Seconds())
	if secondsUntilMidnight < models.MaxSessionSeconds {
		// We still allow the session but the response will carry available seconds
		_ = secondsUntilMidnight
	}

	sessionNumber := int16(len(existing) + 1)
	sess := &models.UserSession{
		UserID:        input.UserID,
		SessionNumber: sessionNumber,
		SessionDate:   today,
		DeviceID:      input.DeviceID,
		DeviceName:    input.DeviceName,
		Status:        models.SessionStatusActive,
	}
	if err := s.db.Create(sess).Error; err != nil {
		return nil, err
	}
	return sess, nil
}

// GetActiveSession returns the current active session for a user, if any.
func (s *SessionService) GetActiveSession(userID uuid.UUID) (*models.UserSession, error) {
	var sess models.UserSession
	err := s.db.Where("user_id = ? AND status = ?", userID, models.SessionStatusActive).
		First(&sess).Error
	if err != nil {
		return nil, err
	}
	return &sess, nil
}

// Heartbeat updates elapsed_seconds from the actual server-side start time.
// Returns the updated elapsed seconds and remaining seconds for this session.
func (s *SessionService) Heartbeat(sessionID uuid.UUID, deviceID string) (elapsed int, remaining int, err error) {
	var sess models.UserSession
	if err = s.db.First(&sess, "id = ?", sessionID).Error; err != nil {
		return 0, 0, errors.New("Session not found.")
	}
	if sess.DeviceID != deviceID {
		return 0, 0, errors.New("Device mismatch.")
	}
	if sess.Status != models.SessionStatusActive {
		return 0, 0, errors.New("Session is not active.")
	}

	// Check midnight boundary
	midnight := time.Date(
		sess.SessionDate.Year(), sess.SessionDate.Month(), sess.SessionDate.Day()+1,
		0, 0, 0, 0, IST,
	)
	if time.Now().After(midnight) {
		_ = s.expireSession(&sess)
		return 0, 0, errors.New("Session expired at midnight.")
	}

	// Compute elapsed from start time — tamper-proof
	liveElapsed := int(time.Since(sess.StartedAt).Seconds())
	if liveElapsed > models.MaxSessionSeconds {
		liveElapsed = models.MaxSessionSeconds
		_ = s.expireSession(&sess)
		return liveElapsed, 0, errors.New("Session time limit of 4 hours reached.")
	}

	if err = s.db.Model(&sess).Update("elapsed_seconds", liveElapsed).Error; err != nil {
		return 0, 0, err
	}
	return liveElapsed, models.MaxSessionSeconds - liveElapsed, nil
}

// EndSession marks a session as ended.
func (s *SessionService) EndSession(sessionID uuid.UUID) error {
	now := time.Now()
	return s.db.Model(&models.UserSession{}).
		Where("id = ? AND status = ?", sessionID, models.SessionStatusActive).
		Updates(map[string]any{
			"status":   models.SessionStatusEnded,
			"ended_at": now,
		}).Error
}

// Takeover transfers the active session to a new device instead of ending it.
// This allows the user to continue their session on a different device.
func (s *SessionService) Takeover(activeSessionID uuid.UUID, newDeviceID string, newDeviceName *string) error {
	updates := map[string]any{
		"device_id": newDeviceID,
	}
	if newDeviceName != nil {
		updates["device_name"] = *newDeviceName
	}
	return s.db.Model(&models.UserSession{}).
		Where("id = ? AND status = ?", activeSessionID, models.SessionStatusActive).
		Updates(updates).Error
}

func (s *SessionService) expireSession(sess *models.UserSession) error {
	now := time.Now()
	liveElapsed := min(int(now.Sub(sess.StartedAt).Seconds()), models.MaxSessionSeconds)
	return s.db.Model(sess).Updates(map[string]any{
		"status":          models.SessionStatusExpired,
		"ended_at":        now,
		"elapsed_seconds": liveElapsed,
	}).Error
}

// ExpireStale is run by the background goroutine. It expires:
//   - Sessions whose elapsed time has reached 4 hours
//   - Sessions that crossed the IST midnight boundary
func (s *SessionService) ExpireStale() {
	var sessions []models.UserSession
	s.db.Where("status = ?", models.SessionStatusActive).Find(&sessions)

	for i := range sessions {
		sess := &sessions[i]

		midnight := time.Date(
			sess.SessionDate.Year(), sess.SessionDate.Month(), sess.SessionDate.Day()+1,
			0, 0, 0, 0, IST,
		)

		liveElapsed := int(time.Since(sess.StartedAt).Seconds())
		if liveElapsed >= models.MaxSessionSeconds || time.Now().After(midnight) {
			_ = s.expireSession(sess)
		}
	}
}
