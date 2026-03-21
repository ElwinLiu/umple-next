package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/model"
)

type SyncHandler struct {
	pool  *compiler.Pool
	store *model.Store
}

func NewSyncHandler(pool *compiler.Pool, store *model.Store) *SyncHandler {
	return &SyncHandler{pool: pool, store: store}
}

type SyncRequest struct {
	Action  string            `json:"action"`
	ModelID string            `json:"modelId,omitempty"`
	Params  map[string]string `json:"params"`
}

type SyncResponse struct {
	Code    string `json:"code"`
	Result  string `json:"result"`
	Errors  string `json:"errors,omitempty"`
	ModelID string `json:"modelId"`
}

// validSyncActions lists the actions supported by umplesync.
var validSyncActions = map[string]bool{
	"addClass":            true,
	"editClass":           true,
	"editPosition":        true,
	"addAssociation":      true,
	"removeAssociation":   true,
	"addGeneralization":   true,
	"removeGeneralization": true,
	"addAttribute":        true,
	"removeAttribute":     true,
	"addMethod":           true,
	"removeMethod":        true,
	"addInterface":        true,
	"removeClass":         true,
}

func (h *SyncHandler) Sync(w http.ResponseWriter, r *http.Request) {
	var req SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Action == "" {
		writeError(w, http.StatusBadRequest, "action is required")
		return
	}
	if !validSyncActions[req.Action] {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported action: %s", req.Action))
		return
	}

	// Ensure model directory exists
	modelID := req.ModelID
	if modelID == "" {
		m, err := h.store.Create("")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create model")
			return
		}
		modelID = m.ID
	}

	dir := h.store.ModelDir(modelID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create model dir")
		return
	}

	// Build umplesync command — serialize params map to
	// comma-separated key=value pairs sorted by key for determinism.
	umpFile := filepath.Join(dir, "model.ump")
	var paramParts []string
	keys := make([]string, 0, len(req.Params))
	for k := range req.Params {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		paramParts = append(paramParts, fmt.Sprintf("%s=%s", k, req.Params[k]))
	}
	paramsStr := strings.Join(paramParts, ",")
	command := fmt.Sprintf("-action %s -actionParams \"%s\" -source %s", req.Action, paramsStr, umpFile)

	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("sync failed: %v", err))
		return
	}

	// Read updated code
	code := ""
	if data, err := os.ReadFile(umpFile); err == nil {
		code = string(data)
	}

	// Read updated JSON model
	jsonModel := ""
	jsonPath := filepath.Join(dir, "model.json")
	if data, err := os.ReadFile(jsonPath); err == nil {
		jsonModel = string(data)
	} else {
		// If no JSON file, use the output from the compiler
		jsonModel = result.Output
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SyncResponse{
		Code:    code,
		Result:  jsonModel,
		Errors:  result.Errors,
		ModelID: modelID,
	})
}
