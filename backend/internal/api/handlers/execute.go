package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/execution"
	"github.com/umple/umple-next/backend/internal/model"
)

type ExecuteHandler struct {
	pool  *compiler.Pool
	store *model.Store
	proxy *execution.Proxy
}

func NewExecuteHandler(pool *compiler.Pool, store *model.Store, proxy *execution.Proxy) *ExecuteHandler {
	return &ExecuteHandler{pool: pool, store: store, proxy: proxy}
}

type ExecuteRequest struct {
	Code     string `json:"code"`
	Language string `json:"language"`
	ModelID  string `json:"modelId,omitempty"`
}

type ExecuteResponse struct {
	Output  string `json:"output"`
	Errors  string `json:"errors,omitempty"`
	ModelID string `json:"modelId"`
}

func (h *ExecuteHandler) Execute(w http.ResponseWriter, r *http.Request) {
	var req ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	if req.Language == "" {
		writeError(w, http.StatusBadRequest, "language is required")
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

	dir := h.store.ModelDir(modelID)

	// First: compile/generate the target language
	command := fmt.Sprintf("-generate %s %s/model.ump", req.Language, dir)
	compileResult, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("compilation failed: %v", err))
		return
	}

	// Proxy to the code-exec service with the model directory path.
	// code-exec handles compile errors itself (checks for main class file).
	execResult, err := h.proxy.Execute(dir, compileResult.Errors, req.Language)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("execution failed: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ExecuteResponse{
		Output:  execResult.Output,
		Errors:  execResult.Errors,
		ModelID: modelID,
	})
}

