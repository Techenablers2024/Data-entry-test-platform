package handlers

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
)

type LogsHandler struct {
	logDir string
	logKey string
}

func NewLogsHandler(logDir, logKey string) *LogsHandler {
	return &LogsHandler{logDir: logDir, logKey: logKey}
}

func (h *LogsHandler) auth(c *gin.Context) bool {
	key := c.Query("key")
	if h.logKey == "" || key != h.logKey {
		utils.Unauthorized(c, "Invalid log key.")
		c.Abort()
		return false
	}
	return true
}

// ViewLogs returns filtered log lines as JSON
func (h *LogsHandler) ViewLogs(c *gin.Context) {
	if !h.auth(c) {
		return
	}

	date := c.DefaultQuery("date", time.Now().In(ist()).Format("2006-01-02"))
	level := c.Query("level")   // info | error | audit
	search := c.Query("search") // free text
	limit := 500

	filename := filepath.Join(h.logDir, fmt.Sprintf("app-%s.log", date))
	f, err := os.Open(filename)
	if err != nil {
		utils.OK(c, gin.H{"lines": []string{}, "date": date, "message": "No logs for this date."})
		return
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		if level != "" && !strings.Contains(line, fmt.Sprintf(`"level":"%s"`, level)) {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(line), strings.ToLower(search)) {
			continue
		}
		lines = append(lines, line)
	}
	if err := scanner.Err(); err != nil {
		utils.InternalError(c, "Failed to read log file.")
		return
	}

	// Return last N lines
	if len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}

	utils.OK(c, gin.H{"lines": lines, "date": date, "count": len(lines)})
}

// ViewLogsUI returns a simple HTML log viewer
func (h *LogsHandler) ViewLogsUI(c *gin.Context) {
	if !h.auth(c) {
		return
	}
	key := c.Query("key")
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DataEntry Pro — Logs</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: monospace; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .header { background: #1e293b; padding: 16px 24px; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .header h1 { color: #60a5fa; font-size: 16px; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  input, select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; font-family: monospace; }
  button { background: #3b82f6; color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  button:hover { background: #2563eb; }
  .logs { padding: 16px; }
  .line { padding: 4px 8px; border-radius: 4px; margin-bottom: 2px; font-size: 12px; line-height: 1.6; word-break: break-all; }
  .line:hover { background: #1e293b; }
  .info { color: #94a3b8; }
  .error { color: #f87171; background: #1a0000; }
  .audit { color: #34d399; }
  .count { color: #64748b; font-size: 12px; padding: 8px 16px; }
</style>
</head>
<body>
<div class="header">
  <h1>📋 DataEntry Pro Logs</h1>
  <div class="filters">
    <input type="date" id="date" value="%s">
    <select id="level">
      <option value="">All Levels</option>
      <option value="info">Info</option>
      <option value="error">Error</option>
      <option value="audit">Audit</option>
    </select>
    <input type="text" id="search" placeholder="Search..." style="width:200px">
    <button onclick="loadLogs()">🔍 Filter</button>
    <button onclick="clearSearch()" style="background:#475569">Clear</button>
  </div>
</div>
<div class="count" id="count"></div>
<div class="logs" id="logs">Loading...</div>

<script>
const KEY = '%s';
function loadLogs() {
  const date = document.getElementById('date').value;
  const level = document.getElementById('level').value;
  const search = document.getElementById('search').value;
  const url = '/logs?key=' + KEY + '&date=' + date + '&level=' + level + '&search=' + encodeURIComponent(search);
  fetch(url).then(r => r.json()).then(data => {
    const lines = data.data?.lines || [];
    document.getElementById('count').textContent = lines.length + ' lines';
    if (!lines.length) { document.getElementById('logs').innerHTML = '<div class="line info">No logs found.</div>'; return; }
    document.getElementById('logs').innerHTML = lines.reverse().map(l => {
      let cls = 'info';
      if (l.includes('"level":"error"')) cls = 'error';
      if (l.includes('"level":"audit"')) cls = 'audit';
      try {
        const obj = JSON.parse(l);
        let pretty = obj.time + ' | ' + (obj.level||'').toUpperCase().padEnd(5) + ' | ' + (obj.event||'') + (obj.method?' | '+obj.method:'') + (obj.path?' '+obj.path:'') + (obj.status?' | '+obj.status:'') + (obj.latency?' | '+obj.latency:'') + (obj.user_id?' | '+obj.user_id:'') + (obj.message?' | '+obj.message:'') + (obj.error?' | ERROR: '+obj.error:'');
        return '<div class="line ' + cls + '">' + pretty.replace(/</g,'&lt;') + '</div>';
      } catch(e) { return '<div class="line ' + cls + '">' + l.replace(/</g,'&lt;') + '</div>'; }
    }).join('');
  }).catch(() => { document.getElementById('logs').textContent = 'Failed to load logs.'; });
}
function clearSearch() {
  document.getElementById('search').value = '';
  document.getElementById('level').value = '';
  loadLogs();
}
document.getElementById('search').addEventListener('keydown', e => { if(e.key==='Enter') loadLogs(); });
loadLogs();
// Auto-refresh every 30s
setInterval(loadLogs, 30000);
</script>
</body>
</html>`,
		time.Now().In(ist()).Format("2006-01-02"),
		key,
	)
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(200, html)
}

func ist() *time.Location {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	return loc
}
