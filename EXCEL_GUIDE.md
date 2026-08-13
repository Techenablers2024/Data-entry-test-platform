# 📋 How to Prepare Your Excel File for Upload

This guide explains how to create an Excel file that can be uploaded to the DataEntry Pro system.

---

## The Basics

Your Excel file must have **exactly this structure**:

| Row | Purpose | Example |
|-----|---------|---------|
| Row 1 | **Column Labels** — the heading for each column | App No, Full Name, Gender |
| Row 2 | **Field Types** — what kind of data goes in each column | display, text, dropdown:Male\|Female |
| Row 3 | **Groups** — which section each column belongs to | Member Info, Member Info, Personal |
| Row 4 onwards | **Your Data** — the actual records | 31313383, MAHANTAPPA, Male |

> ⚠️ **Important:** All 4 rows are required. The file will be rejected if any row is missing.

---

## Field Types (Row 2)

Each column must have one of these types in Row 2:

| Type | What it means | Example in Row 2 |
|------|--------------|-----------------|
| `display` | Reference data shown to the user (read-only, they can see it but not type in it) | `display` |
| `text` | User types free text | `text` |
| `number` | User types a number only | `number` |
| `date` | User picks a date | `date` |
| `fixed` | Value is pre-filled automatically, user cannot change it | `fixed` |
| `dropdown:A\|B\|C` | User picks from a list | `dropdown:Male\|Female\|Other` |

> ✅ You must have **at least one** `display` column and **at least one** input column (text / number / date / dropdown / fixed).

---

## Groups (Row 3)

Groups add a section heading in the data entry screen. Write the same group name across all columns that belong together.

- If you don't want groups, just leave Row 3 cells empty — but the row must still exist.

---

## Dropdown Options — Two Ways

**Option A — Inline (simple lists):**
Write the options directly in Row 2, separated by `|`

```
dropdown:Male|Female|Other
```

**Option B — Options Sheet (long lists):**
1. Create a second sheet named exactly **Options**
2. Put your dropdown name as the column header
3. List each option below it
4. In Row 2, write `dropdown:ColumnName`

Example Options sheet:

| State | District |
|-------|----------|
| Karnataka | Gulbarga |
| Maharashtra | Pune |
| Tamil Nadu | Chennai |

Then in Row 2: `dropdown:State` and `dropdown:District`

---

## Full Example

| | A | B | C | D | E |
|--|---|---|---|---|---|
| **Row 1** | App No | MBI Code | Full Name | Gender | Date of Birth |
| **Row 2** | display | fixed | text | dropdown:Male\|Female\|Other | date |
| **Row 3** | Member Info | Member Info | Personal | Personal | Personal |
| **Row 4** | 31313383 | MBI1109358824 | MAHANTAPPA | Male | |
| **Row 5** | 41234567 | MBI2234567891 | PRIYA SHARMA | Female | |

In the above example:
- **App No** → shown as reference, user sees it but can't change it
- **MBI Code** → auto-filled from the data, locked
- **Full Name** → user types it
- **Gender** → user picks from Male / Female / Other
- **Date of Birth** → user picks a date

---

## Rules & Limits

- ✅ File must be `.xlsx` format (not `.xls` or `.csv`)
- ✅ Maximum **200 columns**
- ✅ Maximum **10,000 data rows** per file
- ✅ Every column in Row 1 must have a label
- ✅ Every column in Row 2 must have a type
- ✅ At least one `display` column required
- ✅ At least one input column required
- ❌ Empty rows in the data section are automatically skipped
- ❌ Rows where the `display` column is empty are skipped with a warning

---

## Common Mistakes

| Problem | Fix |
|---------|-----|
| File rejected — "must have at least 4 rows" | Make sure Row 3 (Groups) exists even if empty |
| "At least one column must be type display" | Add `display` to at least one column in Row 2 |
| Dropdown not working | Check spelling — `dropdown:Male\|Female` (pipe symbol `\|` between options) |
| Rows being skipped | Check that the `display` column has a value in every data row |
| "Unknown type" error | Check Row 2 — only use: `display`, `text`, `number`, `date`, `fixed`, `dropdown:...` |

---

## Quick Checklist Before Uploading

- [ ] File is saved as `.xlsx`
- [ ] Row 1 has all column headings
- [ ] Row 2 has a valid type for every column
- [ ] Row 3 has group names (or is empty but present)
- [ ] At least one column is `display`
- [ ] At least one column is `text`, `number`, `date`, `fixed`, or `dropdown`
- [ ] All data starts from Row 4

---

*For any help, contact your system administrator.*
