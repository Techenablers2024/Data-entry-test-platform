package models

import (
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type FieldType string

const (
	FieldTypeDisplay  FieldType = "display"
	FieldTypeText     FieldType = "text"
	FieldTypeNumber   FieldType = "number"
	FieldTypeDate     FieldType = "date"
	FieldTypeDropdown FieldType = "dropdown"
	FieldTypeFixed    FieldType = "fixed"
)

type FieldConfig struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BatchID         uuid.UUID      `gorm:"type:uuid;not null" json:"batch_id"`
	ColumnKey       string         `gorm:"not null" json:"column_key"`
	Label           string         `gorm:"not null" json:"label"`
	FieldType       FieldType      `gorm:"type:field_type;not null" json:"field_type"`
	IsReference     bool           `gorm:"not null;default:false" json:"is_reference"`
	DropdownOptions pq.StringArray `gorm:"type:text[]" json:"dropdown_options,omitempty"`
	SortOrder       int            `gorm:"not null" json:"sort_order"`
}
