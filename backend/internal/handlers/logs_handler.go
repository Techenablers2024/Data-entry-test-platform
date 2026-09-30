package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"dataentry-platform/backend/internal/logger"
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
	level := c.Query("level")
	search := c.Query("search")
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

	if len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}

	utils.OK(c, gin.H{"lines": lines, "date": date, "count": len(lines)})
}

// ViewLogsStats returns summary counts and available log dates
func (h *LogsHandler) ViewLogsStats(c *gin.Context) {
	if !h.auth(c) {
		return
	}

	date := c.DefaultQuery("date", time.Now().In(ist()).Format("2006-01-02"))

	var total, errs, audits int
	uniqueUsers := map[string]struct{}{}

	filename := filepath.Join(h.logDir, fmt.Sprintf("app-%s.log", date))
	if f, openErr := os.Open(filename); openErr == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if line == "" {
				continue
			}
			var e logger.Entry
			if jsonErr := json.Unmarshal([]byte(line), &e); jsonErr != nil {
				continue
			}
			total++
			if e.Level == logger.LevelError {
				errs++
			}
			if e.Level == logger.LevelAudit {
				audits++
			}
			if e.UserID != "" {
				uniqueUsers[e.UserID] = struct{}{}
			}
		}
		_ = scanner.Err()
	}

	var availableDates []string
	if entries, err := os.ReadDir(h.logDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			name := e.Name()
			if strings.HasPrefix(name, "app-") && strings.HasSuffix(name, ".log") {
				d := strings.TrimSuffix(strings.TrimPrefix(name, "app-"), ".log")
				availableDates = append(availableDates, d)
			}
		}
		sort.Sort(sort.Reverse(sort.StringSlice(availableDates)))
	}

	utils.OK(c, gin.H{
		"total":           total,
		"errors":          errs,
		"audit_events":    audits,
		"unique_users":    len(uniqueUsers),
		"available_dates": availableDates,
	})
}

// ViewLogsUI returns the enhanced HTML log viewer
func (h *LogsHandler) ViewLogsUI(c *gin.Context) {
	if !h.auth(c) {
		return
	}
	key := c.Query("key")
	today := time.Now().In(ist()).Format("2006-01-02")
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DataEntry Pro — Logs</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;background:#0f172a;color:#e2e8f0;min-height:100vh}
.header{background:#1e293b;padding:12px 20px;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.header h1{color:#60a5fa;font-size:15px;font-weight:bold}
.updated{color:#475569;font-size:11px}
.stats{display:flex;gap:10px;padding:12px 20px;background:#0f172a;border-bottom:1px solid #1e293b;flex-wrap:wrap}
.stat{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 18px;min-width:120px;text-align:center}
.stat-val{font-size:24px;font-weight:bold;line-height:1.2}
.stat-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.s-total .stat-val{color:#60a5fa}
.s-err   .stat-val{color:#f87171}
.s-audit .stat-val{color:#34d399}
.s-users .stat-val{color:#a78bfa}
.controls{background:#1e293b;padding:10px 20px;border-bottom:1px solid #334155;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.date-btn{background:#0f172a;color:#94a3b8;border:1px solid #334155;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:monospace}
.date-btn.active,.date-btn:hover{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
.tabs{display:flex;gap:4px;flex-wrap:wrap}
.tab{background:#0f172a;color:#94a3b8;border:1px solid #334155;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:monospace}
.tab.active,.tab:hover{background:#0d9488;color:#fff;border-color:#0d9488}
.search-row{display:flex;gap:6px;margin-left:auto;align-items:center}
input[type=text]{background:#0f172a;border:1px solid #334155;color:#e2e8f0;padding:5px 10px;border-radius:6px;font-size:12px;font-family:monospace;width:200px}
.btn{background:#3b82f6;color:#fff;border:none;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:monospace}
.btn:hover{background:#2563eb}
.btn-clear{background:#475569}.btn-clear:hover{background:#334155}
.count-bar{color:#475569;font-size:11px;padding:6px 20px;background:#0a0f1e;border-bottom:1px solid #1e293b}
.logs{padding:10px 20px}
.line{display:flex;align-items:baseline;gap:8px;padding:3px 6px;border-radius:4px;margin-bottom:1px;font-size:11.5px;line-height:1.7;word-break:break-all}
.line:hover{background:#1e293b}
.lvl-info .detail{color:#94a3b8}
.lvl-error{background:#1a0000}.lvl-error .detail{color:#fca5a5}
.lvl-audit .detail{color:#6ee7b7}
.ts{color:#475569;white-space:nowrap;flex-shrink:0;font-size:11px}
.detail{flex:1}
.status-ok{color:#34d399}.status-err{color:#f87171}
.uid{color:#7dd3fc;font-size:10px}
.err-msg{color:#fca5a5}
.badge{display:inline-block;font-size:9px;font-weight:bold;padding:1px 6px;border-radius:3px;margin-right:4px;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0;white-space:nowrap}
.bg{background:#334155;color:#94a3b8}
.bgreen{background:#064e3b;color:#6ee7b7}
.bred{background:#450a0a;color:#fca5a5}
.bamber{background:#451a03;color:#fcd34d}
.bblue{background:#1e3a5f;color:#93c5fd}
.empty{color:#475569;padding:24px;text-align:center}
</style>
</head>
<body>
<div class="header">
  <h1>&#x1F4CB; DataEntry Pro &mdash; Logs</h1>
  <span class="updated" id="updated">&mdash;</span>
</div>
<div class="stats">
  <div class="stat s-total"><div class="stat-val" id="s-total">&mdash;</div><div class="stat-lbl">Total Requests</div></div>
  <div class="stat s-err">  <div class="stat-val" id="s-err"  >&mdash;</div><div class="stat-lbl">Errors</div></div>
  <div class="stat s-audit"><div class="stat-val" id="s-audit">&mdash;</div><div class="stat-lbl">Audit Events</div></div>
  <div class="stat s-users"><div class="stat-val" id="s-users">&mdash;</div><div class="stat-lbl">Unique Users</div></div>
</div>
<div class="controls">
  <div id="date-btns" style="display:flex;gap:4px;flex-wrap:wrap"></div>
  <div class="tabs">
    <button class="tab active" id="tab-all"      onclick="setTab('all')">All</button>
    <button class="tab"        id="tab-requests"  onclick="setTab('requests')">API Requests</button>
    <button class="tab"        id="tab-auth"      onclick="setTab('auth')">Auth &amp; Audit</button>
    <button class="tab"        id="tab-errors"    onclick="setTab('errors')">Errors</button>
    <button class="tab"        id="tab-system"    onclick="setTab('system')">System</button>
  </div>
  <div class="search-row">
    <input type="text" id="search" placeholder="Search...">
    <button class="btn" onclick="loadLogs()">Filter</button>
    <button class="btn btn-clear" onclick="clearAll()">Clear</button>
  </div>
</div>
<div class="count-bar" id="count">&mdash;</div>
<div class="logs" id="logs">Loading...</div>
<script>
const KEY='%s';
const AUTH_EVENTS=new Set(['login_success','login_failed','password_reset','admin_created','user_status_changed','user_profile_updated','validity_extended']);
let curDate='%s', curTab='all';

function loadStats(){
  fetch('/logs/stats?key='+KEY+'&date='+curDate).then(r=>r.json()).then(d=>{
    const s=d.data||{};
    document.getElementById('s-total').textContent=s.total??0;
    document.getElementById('s-err').textContent=s.errors??0;
    document.getElementById('s-audit').textContent=s.audit_events??0;
    document.getElementById('s-users').textContent=s.unique_users??0;
    const dates=s.available_dates||[];
    document.getElementById('date-btns').innerHTML=dates.map(dt=>
      '<button class="date-btn'+(dt===curDate?' active':'')+'" onclick="switchDate(\''+dt+'\')">'+dt+'</button>'
    ).join('');
  }).catch(()=>{});
}
function switchDate(d){curDate=d;loadStats();loadLogs();}
function setTab(t){
  curTab=t;
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+t).classList.add('active');
  loadLogs();
}
function clearAll(){document.getElementById('search').value='';setTab('all');}

function badge(ev,status){
  if(ev==='login_success') return '<span class="badge bgreen">Login</span>';
  if(ev==='login_failed')  return '<span class="badge bred">Auth Fail</span>';
  if(ev==='password_reset') return '<span class="badge bamber">Password</span>';
  if(ev.startsWith('admin_')||ev.startsWith('user_')||ev==='validity_extended') return '<span class="badge bblue">Admin</span>';
  if(ev==='system'||ev==='panic') return '<span class="badge bred">System</span>';
  if(status>=400) return '<span class="badge bred">Error</span>';
  return '<span class="badge bg">Req</span>';
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function lvlCls(l){return l==='error'?'lvl-error':l==='audit'?'lvl-audit':'lvl-info';}
function matchTab(o){
  const ev=o.event||'', lv=o.level||'';
  if(curTab==='requests') return ev==='request';
  if(curTab==='auth')     return AUTH_EVENTS.has(ev);
  if(curTab==='errors')   return lv==='error';
  if(curTab==='system')   return ev==='system'||ev==='panic';
  return true;
}
function fmtLine(o){
  const b=badge(o.event||'', o.status||0);
  let det='';
  if(o.event==='request'){
    const sc=o.status>=400?'status-err':'status-ok';
    det=esc(o.method)+' '+esc(o.path)+' <span class="'+sc+'">'+o.status+'</span> '+esc(o.latency);
    if(o.user_id) det+=' <span class="uid">'+esc(o.user_id)+'</span>';
  } else if(o.error){
    det='<span class="err-msg">'+esc(o.error)+'</span>';
    if(o.user_id) det+=' <span class="uid">'+esc(o.user_id)+'</span>';
  } else {
    det=esc(o.message||o.event);
    if(o.user_id) det+=' <span class="uid">'+esc(o.user_id)+'</span>';
  }
  return '<div class="line '+lvlCls(o.level)+'"><span class="ts">'+esc(o.time)+'</span>'+b+'<span class="detail">'+det+'</span></div>';
}
function loadLogs(){
  const srch=document.getElementById('search').value;
  fetch('/logs?key='+KEY+'&date='+curDate+'&search='+encodeURIComponent(srch))
    .then(r=>r.json()).then(data=>{
      const raw=data.data?.lines||[];
      let lines=raw.map(l=>{try{return JSON.parse(l);}catch(e){return null;}}).filter(Boolean);
      lines=lines.filter(matchTab).reverse();
      document.getElementById('count').textContent=lines.length+' line'+(lines.length===1?'':'s');
      document.getElementById('updated').textContent='Updated: '+new Date().toLocaleTimeString();
      if(!lines.length){document.getElementById('logs').innerHTML='<div class="empty">No logs found for this filter.</div>';return;}
      document.getElementById('logs').innerHTML=lines.map(fmtLine).join('');
    }).catch(()=>{document.getElementById('logs').textContent='Failed to load logs.';});
}
document.getElementById('search').addEventListener('keydown',e=>{if(e.key==='Enter')loadLogs();});
loadStats();
loadLogs();
setInterval(()=>{loadStats();loadLogs();},30000);
</script>
</body>
</html>`, key, today)
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(200, html)
}

func ist() *time.Location {
	loc, _ := time.LoadLocation("Asia/Kolkata")
	return loc
}
