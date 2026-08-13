package logger

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Level string

const (
	LevelInfo  Level = "info"
	LevelError Level = "error"
	LevelAudit Level = "audit"
)

type Entry struct {
	Time    string `json:"time"`
	Level   Level  `json:"level"`
	Event   string `json:"event"`
	UserID  string `json:"user_id,omitempty"`
	Method  string `json:"method,omitempty"`
	Path    string `json:"path,omitempty"`
	Status  int    `json:"status,omitempty"`
	Latency string `json:"latency,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

var (
	logDir = "logs"
	mu     sync.Mutex
)

func Init(dir string) {
	if dir != "" {
		logDir = dir
	}
	if err := os.MkdirAll(logDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "logger: failed to create log dir: %v\n", err)
	}
	// Start background cleanup
	go runCleanup()
}

func Write(e Entry) {
	e.Time = time.Now().In(ist()).Format("2006-01-02 15:04:05")
	b, err := json.Marshal(e)
	if err != nil {
		return
	}
	b = append(b, '\n')

	mu.Lock()
	defer mu.Unlock()

	filename := filepath.Join(logDir, fmt.Sprintf("app-%s.log", time.Now().In(ist()).Format("2006-01-02")))
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "logger: %v\n", err)
		return
	}
	defer f.Close()
	f.Write(b)
}

func Info(event, message, userID string) {
	Write(Entry{Level: LevelInfo, Event: event, Message: message, UserID: userID})
}

func Error(event, errMsg, userID string) {
	Write(Entry{Level: LevelError, Event: event, Error: errMsg, UserID: userID})
}

func Audit(event, message, userID string) {
	Write(Entry{Level: LevelAudit, Event: event, Message: message, UserID: userID})
}

func runCleanup() {
	for {
		// Run once per day at 2am IST
		now := time.Now().In(ist())
		next := time.Date(now.Year(), now.Month(), now.Day()+1, 2, 0, 0, 0, ist())
		time.Sleep(time.Until(next))
		deleteOldLogs()
	}
}

func deleteOldLogs() {
	cutoff := time.Now().In(ist()).AddDate(0, 0, -3)
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(logDir, e.Name()))
		}
	}
}

func ist() *time.Location {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	return loc
}
