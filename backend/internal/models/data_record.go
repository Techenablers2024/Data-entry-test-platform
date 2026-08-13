package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type RecordStatus string

const (
	RecordStatusActive   RecordStatus = "active"
	RecordStatusDisabled RecordStatus = "disabled"
)

type DataRecord struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	GlobalSequence *int           `json:"global_sequence"`
	RecordCode     string         `gorm:"not null;default:''" json:"record_code"`
	BatchID        uuid.UUID      `gorm:"type:uuid;not null" json:"batch_id"`
	Values         datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"values"`
	Status         RecordStatus   `gorm:"type:record_status;not null;default:active" json:"status"`
	CreatedAt      time.Time      `json:"created_at"`
}
