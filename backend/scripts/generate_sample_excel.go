package main

import (
	"log"
	"strconv"

	"github.com/xuri/excelize/v2"
)

// field defines one data field — it becomes two columns in the Excel:
// col 1: display (shown on left as reference)
// col 2: input   (user types on right)
type field struct {
	name      string // label shown in both panels
	inputType string // text | number | date | dropdown:ColName
}

func main() {
	f := excelize.NewFile()

	// ── Sheet 2: Options ───────────────────────────────────────────────────────
	optionsSheet := "Options"
	f.NewSheet(optionsSheet)

	optionColumns := []struct {
		name string
		opts []string
	}{
		{"Gender", []string{"Male", "Female", "Other"}},
		{"Marital Status", []string{"Never Married", "Married", "Divorced", "Widowed"}},
		{"House Type", []string{"Own", "Rented", "Others"}},
		{"Mother Tongue", []string{"Malayalam", "Hindi", "Tamil", "Telugu", "Kannada", "English", "Bengali", "Assamese", "Other"}},
		{"Religion", []string{"Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"}},
		{"Health Info", []string{"No Health Problems", "Diabetes", "Blood Pressure", "Heart Disease", "Other"}},
		{"Any Disability", []string{"None", "Physical", "Visual", "Hearing", "Other"}},
		{"Diet", []string{"Veg", "Non-Veg", "Eggetarian"}},
		{"Father Status", []string{"Alive", "Deceased"}},
		{"Mother Status", []string{"Alive", "Deceased"}},
		{"Emp Status", []string{"Business / Self Employed", "Salaried", "Government", "Not Working", "Other"}},
		{"Annual Income", []string{"Below 1 Lakh", "1 to 3 Lakh", "3 to 5 Lakh", "5 to 10 Lakh", "10 to 20 Lakh", "20 to 30 Lakh Annually", "Above 30 Lakh"}},
	}

	optHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"375623"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})
	for colIdx, col := range optionColumns {
		cellName, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(optionsSheet, cellName, col.name)
		colLetter, _ := excelize.ColumnNumberToName(colIdx + 1)
		f.SetColWidth(optionsSheet, colLetter, colLetter, 26)
		for rowIdx, val := range col.opts {
			c, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(optionsSheet, c, val)
		}
	}
	lastOptCol, _ := excelize.CoordinatesToCellName(len(optionColumns), 1)
	f.SetCellStyle(optionsSheet, "A1", lastOptCol, optHeaderStyle)

	// ── Field definitions ──────────────────────────────────────────────────────
	// Each field generates TWO columns: one display + one input
	fields := []field{
		// Basic identifiers
		{"App No",          "text"},
		{"MBI Code",        "text"},
		{"Full Name",       "text"},
		// Personal
		{"Gender",          "dropdown:Gender"},
		{"Date of Birth",   "text"},
		{"Marital Status",  "dropdown:Marital Status"},
		// Address
		{"State",           "text"},
		{"District",        "text"},
		{"Taluk",           "text"},
		{"Pincode",         "number"},
		{"House Type",      "dropdown:House Type"},
		// Religious & Astro
		{"RAI Code",        "text"},
		{"Mother Tongue",   "dropdown:Mother Tongue"},
		{"Religion",        "dropdown:Religion"},
		{"Cast",            "text"},
		{"Sub Cast",        "text"},
		{"Nakshatra",       "text"},
		{"Rashi",           "text"},
		{"Pada",            "text"},
		// Physical
		{"PHI Code",        "text"},
		{"Health Info",     "dropdown:Health Info"},
		{"Any Disability",  "dropdown:Any Disability"},
		{"Diet",            "dropdown:Diet"},
		{"Height",          "text"},
		{"Weight (Kgs)",    "number"},
		// Family
		{"FAI Code",        "text"},
		{"Father Status",   "dropdown:Father Status"},
		{"Father Name",     "text"},
		{"Mother Status",   "dropdown:Mother Status"},
		{"Mother Name",     "text"},
		{"Sister",          "text"},
		{"Brother",         "text"},
		{"Children Boy",    "text"},
		{"Children Girl",   "text"},
		// Education & Career
		{"ECI Code",        "text"},
		{"Education",       "text"},
		{"Emp Status",      "dropdown:Emp Status"},
		{"Annual Income",   "dropdown:Annual Income"},
	}

	// ── Build Sheet1 rows 1 & 2 ────────────────────────────────────────────────
	// Each field → 2 columns: [display col] [input col]
	var labels []string
	var types  []string
	for _, fd := range fields {
		labels = append(labels, fd.name)          // display col label
		types  = append(types, "display")          // display col type

		labels = append(labels, "Enter "+fd.name) // input col label
		types  = append(types, fd.inputType)       // input col type
	}

	// ── Dummy data rows ────────────────────────────────────────────────────────
	// For each row: display cols get the reference value, input cols get empty string
	type memberData struct {
		values map[string]string
	}
	members := []map[string]string{
		{
			"App No": "31313383", "MBI Code": "MBI1109358824", "Full Name": "MANJIL DEURI",
			"Gender": "Male", "Date of Birth": "17 June 1985", "Marital Status": "Never Married",
			"State": "Assam", "District": "Lakhimpur", "Taluk": "Bihupuria", "Pincode": "784164", "House Type": "Own",
			"RAI Code": "RAI1070656301", "Mother Tongue": "Malayalam", "Religion": "Hindu", "Cast": "Nair", "Sub Cast": "Valakathala",
			"Nakshatra": "Magha / Makam", "Rashi": "Simha / Leo", "Pada": "1st Pada",
			"PHI Code": "PHI1649523358", "Health Info": "No Health Problems", "Any Disability": "None", "Diet": "Non-Veg",
			"Height": "5.08 / 68 in / 172.7 cm", "Weight (Kgs)": "68",
			"FAI Code": "FAI1649523358", "Father Status": "Alive", "Father Name": "KRISHNA KUMAR DEURI",
			"Mother Status": "Alive", "Mother Name": "DEVABALA DEURI",
			"Sister": "2 Sisters", "Brother": "No Brother", "Children Boy": "Not Applicable", "Children Girl": "Not Applicable",
			"ECI Code": "ECI1119893053", "Education": "CPHERI", "Emp Status": "Business / Self Employed", "Annual Income": "20 to 30 Lakh Annually",
		},
		{
			"App No": "31313384", "MBI Code": "MBI1109358825", "Full Name": "PRIYA SHARMA",
			"Gender": "Female", "Date of Birth": "04 March 1990", "Marital Status": "Married",
			"State": "Maharashtra", "District": "Pune", "Taluk": "Haveli", "Pincode": "411001", "House Type": "Rented",
			"RAI Code": "RAI2080123456", "Mother Tongue": "Hindi", "Religion": "Hindu", "Cast": "Brahmin", "Sub Cast": "Kashyap",
			"Nakshatra": "Rohini", "Rashi": "Vrishabha / Taurus", "Pada": "2nd Pada",
			"PHI Code": "PHI2050781234", "Health Info": "Diabetes", "Any Disability": "None", "Diet": "Veg",
			"Height": "5.04 / 64 in / 162.5 cm", "Weight (Kgs)": "55",
			"FAI Code": "FAI2050781234", "Father Status": "Deceased", "Father Name": "RAMESH SHARMA",
			"Mother Status": "Alive", "Mother Name": "SUNITA SHARMA",
			"Sister": "1 Sister", "Brother": "1 Brother", "Children Boy": "1 Boy", "Children Girl": "Not Applicable",
			"ECI Code": "ECI2234567890", "Education": "MBA", "Emp Status": "Salaried", "Annual Income": "10 to 20 Lakh",
		},
		{
			"App No": "31313385", "MBI Code": "MBI1109358826", "Full Name": "RAHUL VERMA",
			"Gender": "Male", "Date of Birth": "22 August 1988", "Marital Status": "Never Married",
			"State": "Delhi", "District": "South Delhi", "Taluk": "Saket", "Pincode": "110017", "House Type": "Rented",
			"RAI Code": "RAI3090654321", "Mother Tongue": "Hindi", "Religion": "Hindu", "Cast": "Kayastha", "Sub Cast": "Srivastava",
			"Nakshatra": "Ashwini", "Rashi": "Mesha / Aries", "Pada": "3rd Pada",
			"PHI Code": "PHI3090654321", "Health Info": "No Health Problems", "Any Disability": "None", "Diet": "Non-Veg",
			"Height": "5.10 / 70 in / 177.8 cm", "Weight (Kgs)": "75",
			"FAI Code": "FAI3090654321", "Father Status": "Alive", "Father Name": "SURESH VERMA",
			"Mother Status": "Alive", "Mother Name": "KAVITA VERMA",
			"Sister": "No Sister", "Brother": "1 Brother", "Children Boy": "Not Applicable", "Children Girl": "Not Applicable",
			"ECI Code": "ECI3345678901", "Education": "B.Tech", "Emp Status": "Salaried", "Annual Income": "10 to 20 Lakh",
		},
	}

	// Build rows: display col gets value, input col gets empty
	var dataRows [][]string
	for _, m := range members {
		var row []string
		for _, fd := range fields {
			row = append(row, m[fd.name]) // display col value
			row = append(row, "")         // input col — blank, user fills this
		}
		dataRows = append(dataRows, row)
	}

	// ── Write Sheet1 ───────────────────────────────────────────────────────────
	dataSheet := "Sheet1"

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"1F4E79"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", WrapText: true},
	})
	typeStyle, _ := f.NewStyle(&excelize.Style{
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"E2EFDA"}, Pattern: 1},
		Font:      &excelize.Font{Color: "375623", Size: 9},
		Alignment: &excelize.Alignment{WrapText: true},
	})
	displayDataStyle, _ := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Color: []string{"D6E4F0"}, Pattern: 1},
	})

	// Row 1: labels
	for col, val := range labels {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		f.SetCellValue(dataSheet, cell, val)
	}
	lastCol, _ := excelize.CoordinatesToCellName(len(labels), 1)
	f.SetCellStyle(dataSheet, "A1", lastCol, headerStyle)

	// Row 2: types
	for col, val := range types {
		cell, _ := excelize.CoordinatesToCellName(col+1, 2)
		f.SetCellValue(dataSheet, cell, val)
	}
	lastColRow2, _ := excelize.CoordinatesToCellName(len(types), 2)
	f.SetCellStyle(dataSheet, "A2", lastColRow2, typeStyle)

	// Rows 3+: data — shade display cols, leave input cols white
	for rowIdx, row := range dataRows {
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+3)
			f.SetCellValue(dataSheet, cell, val)
		}
		// Shade every display column (even indices: 0, 2, 4, ...)
		for colIdx := 0; colIdx < len(row); colIdx += 2 {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+3)
			f.SetCellStyle(dataSheet, cell, cell, displayDataStyle)
		}
	}

	// Column widths
	for i := range labels {
		col, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(dataSheet, col, col, 24)
	}
	f.SetRowHeight(dataSheet, 1, 35)
	f.SetRowHeight(dataSheet, 2, 45)

	// Freeze top 2 rows
	f.SetPanes(dataSheet, &excelize.Panes{
		Freeze: true, YSplit: 2, TopLeftCell: "A3", ActivePane: "bottomLeft",
	})

	sheetIdx, _ := f.GetSheetIndex(dataSheet)
	f.SetActiveSheet(sheetIdx)

	outPath := "sample_upload.xlsx"
	if err := f.SaveAs(outPath); err != nil {
		log.Fatal(err)
	}
	log.Printf("✅ Sample Excel created: %s", outPath)
	log.Printf("   Fields: %d  →  Columns: %d (display + input pairs)", len(fields), len(labels))
	log.Printf("   Data rows: %d", len(dataRows))
	_ = strconv.Itoa // used for rowIdx shading above if needed
}
