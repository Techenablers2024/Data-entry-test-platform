package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"dataentry-platform/backend/internal/models"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	maxColumns    = 200
	maxRows       = 10000
	optionsSheet  = "Options"
)

type ExcelService struct {
	db *gorm.DB
}

func NewExcelService(db *gorm.DB) *ExcelService {
	return &ExcelService{db: db}
}

type ParseResult struct {
	Batch        *models.Batch
	FieldConfigs []*models.FieldConfig
	RecordCount  int
	Warnings     []string
}

// ParseAndStore reads the uploaded .xlsx bytes, validates the format, and
// inserts a batch, its field configs, and all data records in one transaction.
func (s *ExcelService) ParseAndStore(filename string, fileBytes []byte, uploadedBy uuid.UUID) (*ParseResult, error) {
	f, err := excelize.OpenReader(bytes.NewReader(fileBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, errors.New("Excel file has no sheets")
	}

	// Load dropdown options from the Options sheet (if present)
	optionsMap := loadOptionsSheet(f)

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("failed to read sheet: %w", err)
	}
	if len(rows) < 3 {
		return nil, errors.New("file must have at least 3 rows: labels (row 1), types (row 2), and one data row")
	}

	labelRow := rows[0]
	typeRow  := rows[1]
	dataRows := rows[2:]

	if len(labelRow) == 0 {
		return nil, errors.New("row 1 (labels) is empty")
	}
	if len(labelRow) > maxColumns {
		return nil, fmt.Errorf("too many columns: max %d, got %d", maxColumns, len(labelRow))
	}
	if len(dataRows) > maxRows {
		return nil, fmt.Errorf("too many data rows: max %d, got %d", maxRows, len(dataRows))
	}

	fieldConfigs, warnings, err := parseFieldConfigs(labelRow, typeRow, optionsMap)
	if err != nil {
		return nil, err
	}

	hasRef, hasInput := false, false
	for _, fc := range fieldConfigs {
		if fc.IsReference {
			hasRef = true
		} else {
			hasInput = true
		}
	}
	if !hasRef {
		return nil, errors.New("at least one column must be type 'display'")
	}
	if !hasInput {
		return nil, errors.New("at least one column must be an input type (text, number, date, or dropdown)")
	}

	records, rowWarnings := parseDataRows(dataRows, fieldConfigs)
	warnings = append(warnings, rowWarnings...)
	if len(records) == 0 {
		return nil, errors.New("no valid data rows found in the file")
	}

	result := &ParseResult{Warnings: warnings}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		batch := &models.Batch{
			Filename:    filename,
			UploadedBy:  uploadedBy,
			RecordCount: len(records),
		}
		if err := tx.Create(batch).Error; err != nil {
			return err
		}
		result.Batch = batch

		for i := range fieldConfigs {
			fieldConfigs[i].BatchID = batch.ID
		}
		if err := tx.Create(&fieldConfigs).Error; err != nil {
			return err
		}
		result.FieldConfigs = fieldConfigs

		// Assign gapless global_sequence values via locked counter
		var counter struct{ NextVal int }
		if err := tx.Raw("SELECT next_val FROM sequence_counter WHERE id = 1 FOR UPDATE").
			Scan(&counter).Error; err != nil {
			return err
		}
		startSeq := counter.NextVal

		for i, rec := range records {
			seq := startSeq + i
			rec.BatchID = batch.ID
			rec.GlobalSequence = &seq
		}
		if err := tx.Create(&records).Error; err != nil {
			return err
		}

		newNext := startSeq + len(records)
		if err := tx.Exec("UPDATE sequence_counter SET next_val = ? WHERE id = 1", newNext).Error; err != nil {
			return err
		}

		result.RecordCount = len(records)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// loadOptionsSheet reads the "Options" sheet and returns a map of
// column-header → []option-values. Column headers are the dropdown names.
//
// Example Options sheet:
//   Gender    | Marital Status | Diet
//   Male      | Never Married  | Veg
//   Female    | Married        | Non-Veg
//   Other     | Divorced       | Eggetarian
//             | Widowed        |
func loadOptionsSheet(f *excelize.File) map[string][]string {
	result := make(map[string][]string)

	rows, err := f.GetRows(optionsSheet)
	if err != nil || len(rows) == 0 {
		return result // Options sheet is optional
	}

	headers := rows[0]
	for colIdx, header := range headers {
		header = strings.TrimSpace(header)
		if header == "" {
			continue
		}
		var opts []string
		for _, row := range rows[1:] {
			if colIdx >= len(row) {
				continue
			}
			val := strings.TrimSpace(row[colIdx])
			if val != "" {
				opts = append(opts, val)
			}
		}
		if len(opts) > 0 {
			result[header] = opts
		}
	}
	return result
}

func parseFieldConfigs(labelRow, typeRow []string, optionsMap map[string][]string) ([]*models.FieldConfig, []string, error) {
	var warnings []string
	var configs []*models.FieldConfig

	for i, label := range labelRow {
		label = strings.TrimSpace(label)
		if label == "" {
			warnings = append(warnings, fmt.Sprintf("column %d has empty label, skipping", i+1))
			continue
		}

		rawType := ""
		if i < len(typeRow) {
			rawType = strings.TrimSpace(typeRow[i])
		}
		if rawType == "" {
			return nil, nil, fmt.Errorf("column %d (%q): type is missing in row 2", i+1, label)
		}

		fc, err := parseOneFieldConfig(label, rawType, i, optionsMap)
		if err != nil {
			return nil, nil, err
		}
		configs = append(configs, fc)
	}
	return configs, warnings, nil
}

func parseOneFieldConfig(label, rawType string, index int, optionsMap map[string][]string) (*models.FieldConfig, error) {
	fc := &models.FieldConfig{
		ColumnKey: fmt.Sprintf("col_%d", index+1),
		Label:     label,
		SortOrder: index,
	}

	lower := strings.ToLower(strings.TrimSpace(rawType))
	switch {
	case lower == "display":
		fc.FieldType = models.FieldTypeDisplay
		fc.IsReference = true

	case lower == "text":
		fc.FieldType = models.FieldTypeText

	case lower == "number":
		fc.FieldType = models.FieldTypeNumber

	case lower == "date":
		fc.FieldType = models.FieldTypeDate

	case lower == "fixed":
		fc.FieldType = models.FieldTypeFixed

	case strings.HasPrefix(lower, "dropdown:"):
		optPart := strings.TrimSpace(rawType[len("dropdown:"):])

		var opts []string
		if strings.Contains(optPart, "|") {
			// Old inline format: dropdown:Opt1|Opt2|Opt3
			opts = strings.Split(optPart, "|")
		} else {
			// New sheet-reference format: dropdown:SheetColumnName
			opts = optionsMap[optPart]
			if len(opts) == 0 {
				return nil, fmt.Errorf(
					"column %d (%q): dropdown refers to %q but that column was not found in the Options sheet",
					index+1, label, optPart,
				)
			}
		}

		if len(opts) == 0 || (len(opts) == 1 && opts[0] == "") {
			return nil, fmt.Errorf("column %d (%q): dropdown must have at least one option", index+1, label)
		}
		fc.FieldType = models.FieldTypeDropdown
		fc.DropdownOptions = opts

	default:
		return nil, fmt.Errorf(
			"column %d (%q): unknown type %q (valid: display, text, number, date, fixed, dropdown:ColName or dropdown:A|B|C)",
			index+1, label, rawType,
		)
	}
	return fc, nil
}

func parseDataRows(dataRows [][]string, fieldConfigs []*models.FieldConfig) ([]*models.DataRecord, []string) {
	var records []*models.DataRecord
	var warnings []string

	for rowIdx, row := range dataRows {
		// Skip entirely empty rows
		allEmpty := true
		for _, cell := range row {
			if strings.TrimSpace(cell) != "" {
				allEmpty = false
				break
			}
		}
		if allEmpty {
			continue
		}

		// Skip rows missing any reference column value
		skip := false
		for _, fc := range fieldConfigs {
			if !fc.IsReference {
				continue
			}
			val := ""
			if fc.SortOrder < len(row) {
				val = strings.TrimSpace(row[fc.SortOrder])
			}
			if val == "" {
				warnings = append(warnings, fmt.Sprintf("row %d: reference column %q is empty, skipping", rowIdx+3, fc.Label))
				skip = true
				break
			}
		}
		if skip {
			continue
		}

		values := make(map[string]string, len(fieldConfigs))
		for _, fc := range fieldConfigs {
			val := ""
			if fc.SortOrder < len(row) {
				val = strings.TrimSpace(row[fc.SortOrder])
			}
			values[fc.ColumnKey] = val
		}

		b, err := json.Marshal(values)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("row %d: failed to serialize, skipping", rowIdx+3))
			continue
		}
		records = append(records, &models.DataRecord{
			Values: datatypes.JSON(b),
		})
	}
	return records, warnings
}
