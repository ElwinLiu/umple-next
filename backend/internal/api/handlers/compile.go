package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/model"
)

type CompileHandler struct {
	pool  *compiler.Pool
	store *model.Store
}

func NewCompileHandler(pool *compiler.Pool, store *model.Store) *CompileHandler {
	return &CompileHandler{pool: pool, store: store}
}

type CompileRequest struct {
	Code    string `json:"code"`
	ModelID string `json:"modelId,omitempty"`
}

type CompileResponse struct {
	Result  string `json:"result"`
	Errors  string `json:"errors,omitempty"`
	ModelID string `json:"modelId"`
}

func (h *CompileHandler) Compile(w http.ResponseWriter, r *http.Request) {
	var req CompileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	// Ensure model directory exists
	modelID := req.ModelID
	if modelID == "" {
		m, err := h.store.Create(req.Code)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create model")
			return
		}
		modelID = m.ID
	} else {
		// Update existing model
		dir := h.store.ModelDir(modelID)
		if err := os.MkdirAll(dir, 0755); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create model dir")
			return
		}
		if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte(req.Code), 0644); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to write model")
			return
		}
	}

	// Compile to JSON using umplesync
	dir := h.store.ModelDir(modelID)
	command := fmt.Sprintf("-generate Json %s/model.ump", dir)

	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("compile failed: %v", err))
		return
	}

	// Try to read generated JSON output
	jsonOutput := result.Output
	jsonPath := filepath.Join(dir, "model.json")
	if data, err := os.ReadFile(jsonPath); err == nil {
		jsonOutput = string(data)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CompileResponse{
		Result:  jsonOutput,
		Errors:  result.Errors,
		ModelID: modelID,
	})
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
