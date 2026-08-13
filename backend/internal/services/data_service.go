package services

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"unicode"

	"dataentry-platform/backend/internal/models"
	"dataentry-platform/backend/internal/utils"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type DataService struct {
	db *gorm.DB
}

func NewDataService(db *gorm.DB) *DataService {
	return &DataService{db: db}
}

type RecordWithConfig struct {
	Record      *models.DataRecord   `json:"record"`
	FieldConfig []*models.FieldConfig `json:"field_config"`
}

type RecordProgress struct {
	Total     int64 `json:"total"`
	Completed int64 `json:"completed"`
	Pending   int64 `json:"pending"`
}

// GetProgress returns total active records, how many this user has completed, and how many remain.
func (s *DataService) GetProgress(userID uuid.UUID) (*RecordProgress, error) {
	var total int64
	s.db.Model(&models.DataRecord{}).Where("status = ?", models.RecordStatusActive).Count(&total)

	var completed int64
	s.db.Model(&models.UserSubmission{}).Where("user_id = ?", userID).Count(&completed)

	return &RecordProgress{
		Total:     total,
		Completed: completed,
		Pending:   total - completed,
	}, nil
}

// NextRecord returns a random active record not yet submitted by this user.
func (s *DataService) NextRecord(userID uuid.UUID) (*RecordWithConfig, error) {
	var submittedIDs []uuid.UUID
	s.db.Model(&models.UserSubmission{}).
		Where("user_id = ?", userID).
		Pluck("data_record_id", &submittedIDs)

	var record models.DataRecord
	query := s.db.Where("status = ?", models.RecordStatusActive).
		Order("RANDOM()")

	if len(submittedIDs) > 0 {
		query = query.Where("id NOT IN ?", submittedIDs)
	}

	if err := query.First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("No more records available.")
		}
		return nil, err
	}

	configs, err := s.fieldConfigsForBatch(record.BatchID)
	if err != nil {
		return nil, err
	}
	return &RecordWithConfig{Record: &record, FieldConfig: configs}, nil
}

// GetRecord returns a single record with its field configs.
func (s *DataService) GetRecord(recordID uuid.UUID) (*RecordWithConfig, error) {
	var record models.DataRecord
	if err := s.db.First(&record, "id = ?", recordID).Error; err != nil {
		return nil, err
	}
	configs, err := s.fieldConfigsForBatch(record.BatchID)
	if err != nil {
		return nil, err
	}
	return &RecordWithConfig{Record: &record, FieldConfig: configs}, nil
}

type SubmitInput struct {
	UserID      uuid.UUID
	RecordID    uuid.UUID
	SessionID   uuid.UUID
	InputValues map[string]string
}

// Submit saves the user's input, validates against expected values, and stores accuracy.
func (s *DataService) Submit(input SubmitInput) (*models.UserSubmission, error) {
	var sess models.UserSession
	if err := s.db.First(&sess, "id = ? AND status = ?", input.SessionID, models.SessionStatusActive).Error; err != nil {
		return nil, errors.New("No active session found. Cannot submit.")
	}

	var record models.DataRecord
	if err := s.db.First(&record, "id = ? AND status = ?", input.RecordID, models.RecordStatusActive).Error; err != nil {
		return nil, errors.New("Record not found or inactive.")
	}

	var existing models.UserSubmission
	if err := s.db.Where("session_id = ? AND data_record_id = ?", input.SessionID, input.RecordID).
		First(&existing).Error; err == nil {
		return nil, errors.New("Record already submitted in this session.")
	}

	// Load field configs to know which columns are input fields
	configs, err := s.fieldConfigsForBatch(record.BatchID)
	if err != nil {
		return nil, err
	}

	// Unmarshal record values
	var recordValues map[string]string
	if err := json.Unmarshal(record.Values, &recordValues); err != nil {
		return nil, errors.New("Failed to parse record values.")
	}

	// Validate each input field against its paired display field
	// Convention: display col is col_N, input col is col_(N+1)
	// Build a map from input column_key → expected value via the paired display col
	validation := make(map[string]models.FieldValidation)
	correctCount := 0
	totalCount := 0

	inputFields := make([]*models.FieldConfig, 0)
	refFields   := make([]*models.FieldConfig, 0)
	for _, fc := range configs {
		if fc.IsReference {
			refFields = append(refFields, fc)
		} else if fc.FieldType != models.FieldTypeFixed {
			inputFields = append(inputFields, fc)
		}
	}

	// Auto-fill fixed fields from record values
	for _, fc := range configs {
		if fc.FieldType == models.FieldTypeFixed {
			input.InputValues[fc.ColumnKey] = recordValues[fc.ColumnKey]
		}
	}

	for i, inputField := range inputFields {
		totalCount++
		entered  := input.InputValues[inputField.ColumnKey]
		expected := ""
		if i < len(refFields) {
			expected = recordValues[refFields[i].ColumnKey]
		}

		correct := normalise(entered) == normalise(expected)
		if correct {
			correctCount++
		}
		validation[inputField.ColumnKey] = models.FieldValidation{
			Expected: expected,
			Entered:  entered,
			Correct:  correct,
		}
	}

	accuracy := 0.0
	if totalCount > 0 {
		accuracy = float64(correctCount) / float64(totalCount) * 100
	}

	sub := &models.UserSubmission{
		UserID:         input.UserID,
		DataRecordID:   input.RecordID,
		SessionID:      input.SessionID,
		InputValues:    datatypes.JSON(utils.MustJSONMarshal(input.InputValues)),
		SequenceNumber: deref(record.GlobalSequence),
		Validation:     datatypes.JSON(utils.MustJSONMarshal(validation)),
		CorrectCount:   correctCount,
		TotalCount:     totalCount,
		Accuracy:       accuracy,
	}
	if err := s.db.Create(sub).Error; err != nil {
		return nil, err
	}
	return sub, nil
}

// --- Report types ---

type FieldReport struct {
	FieldLabel string `json:"field_label"`
	Expected   string `json:"expected"`
	Entered    string `json:"entered"`
	Correct    bool   `json:"correct"`
}

type SubmissionReport struct {
	SubmissionID   uuid.UUID     `json:"submission_id"`
	SequenceNumber int           `json:"sequence_number"`
	SubmittedAt    string        `json:"submitted_at"`
	CorrectCount   int           `json:"correct_count"`
	TotalCount     int           `json:"total_count"`
	Accuracy       float64       `json:"accuracy"`
	Fields         []FieldReport `json:"fields"`
}

type UserReport struct {
	UserID       uuid.UUID          `json:"user_id"`
	UserName     string             `json:"user_name"`
	TotalRecords int                `json:"total_records"`
	AvgAccuracy  float64            `json:"avg_accuracy"`
	Page         int                `json:"page"`
	Limit        int                `json:"limit"`
	TotalPages   int                `json:"total_pages"`
	Submissions  []SubmissionReport `json:"submissions"`
}

// GetUserReport returns paginated validation report for a user.
func (s *DataService) GetUserReport(userID uuid.UUID, page, limit int) (*UserReport, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, errors.New("User not found.")
	}

	// Total count
	var total int64
	s.db.Model(&models.UserSubmission{}).Where("user_id = ?", userID).Count(&total)

	// Overall accuracy across all submissions
	var avgAcc struct{ Avg float64 }
	s.db.Model(&models.UserSubmission{}).
		Select("COALESCE(AVG(accuracy), 0) as avg").
		Where("user_id = ?", userID).
		Scan(&avgAcc)

	// Paginated submissions
	offset := (page - 1) * limit
	var submissions []models.UserSubmission
	if err := s.db.Where("user_id = ?", userID).
		Order("submitted_at ASC").
		Limit(limit).Offset(offset).
		Find(&submissions).Error; err != nil {
		return nil, err
	}

	var subReports []SubmissionReport
	for _, sub := range submissions {
		var record models.DataRecord
		if err := s.db.First(&record, "id = ?", sub.DataRecordID).Error; err != nil {
			continue
		}
		configs, _ := s.fieldConfigsForBatch(record.BatchID)

		labelMap := make(map[string]string)
		for _, fc := range configs {
			labelMap[fc.ColumnKey] = fc.Label
		}

		var valMap map[string]models.FieldValidation
		_ = json.Unmarshal(sub.Validation, &valMap)

		var fields []FieldReport
		for colKey, fv := range valMap {
			fields = append(fields, FieldReport{
				FieldLabel: labelMap[colKey],
				Expected:   fv.Expected,
				Entered:    fv.Entered,
				Correct:    fv.Correct,
			})
		}

		subReports = append(subReports, SubmissionReport{
			SubmissionID:   sub.ID,
			SequenceNumber: sub.SequenceNumber,
			SubmittedAt:    sub.SubmittedAt.Format("2006-01-02 15:04:05"),
			CorrectCount:   sub.CorrectCount,
			TotalCount:     sub.TotalCount,
			Accuracy:       sub.Accuracy,
			Fields:         fields,
		})
	}

	return &UserReport{
		UserID:       user.ID,
		UserName:     user.Name,
		TotalRecords: int(total),
		AvgAccuracy:  avgAcc.Avg,
		Submissions:  subReports,
		Page:         page,
		Limit:        limit,
		TotalPages:   int((total + int64(limit) - 1) / int64(limit)),
	}, nil
}

func (s *DataService) fieldConfigsForBatch(batchID uuid.UUID) ([]*models.FieldConfig, error) {
	var configs []*models.FieldConfig
	if err := s.db.Where("batch_id = ?", batchID).
		Order("sort_order ASC").Find(&configs).Error; err != nil {
		return nil, err
	}
	return configs, nil
}

func deref(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

// normalise strips spaces, special characters, and lowercases for comparison.
var reSpecial = regexp.MustCompile(`[^a-z0-9]`)

func normalise(s string) string {
	// Lowercase
	s = strings.ToLower(s)
	// Remove accents / non-ASCII by keeping only printable ASCII letters and digits
	var b strings.Builder
	for _, r := range s {
		if r <= 127 && (unicode.IsLetter(r) || unicode.IsDigit(r)) {
			b.WriteRune(r)
		}
	}
	return reSpecial.ReplaceAllString(b.String(), "")
}
