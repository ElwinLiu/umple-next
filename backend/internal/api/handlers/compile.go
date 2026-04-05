package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umpleonline/backend/internal/compiler"
	"github.com/umple/umpleonline/backend/internal/model"
)

type CompileHandler struct {
	pool  *compiler.Pool
	store *model.Store
}

func NewCompileHandler(pool *compiler.Pool, store *model.Store) *CompileHandler {
	return &CompileHandler{pool: pool, store: store}
}

type CompileRequest struct {
	Code        string       `json:"code"`
	ModelID     string       `json:"modelId,omitempty"`
	DiagramType string       `json:"diagramType,omitempty"`
	Suboptions  []string     `json:"suboptions,omitempty"`
	NeedsLayout *bool        `json:"needsLayout,omitempty"`
	Tabs        []apiTab     `json:"tabs,omitempty"`
	ActiveTabID string       `json:"activeTabId,omitempty"`
}

type CompileResponse struct {
	Result       string                `json:"result"`
	Errors       string                `json:"errors,omitempty"`
	ModelID      string                `json:"modelId"`
	SVG          string                `json:"svg,omitempty"`
	HTML         string                `json:"html,omitempty"`
	Layout       *GvLayout             `json:"layout,omitempty"`
	StoredLayout *StoredLayoutMetadata `json:"storedLayout,omitempty"`
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

	// Determine the compiler entry point: the active tab's file, or the
	// default for single-tab mode.
	entryFile := model.DefaultEntryFile
	entryCode := req.Code
	if len(req.Tabs) > 0 {
		seen := make(map[string]bool, len(req.Tabs))
		for _, t := range req.Tabs {
			safe, err := model.SafeTabName(t.Name)
			if err != nil {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid tab name: %s", t.Name))
				return
			}
			if seen[safe] {
				writeError(w, http.StatusBadRequest, fmt.Sprintf("duplicate tab name: %s", safe))
				return
			}
			seen[safe] = true
			if t.ID == req.ActiveTabID {
				entryFile = safe
				entryCode = t.Code
			}
		}
	}

	// Ensure model directory exists (single resolveModel for both compile + diagram)
	modelID, dir, err := resolveModel(h.store, req.ModelID, entryCode, entryFile)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to resolve model: %v", err))
		return
	}

	// Persist tab metadata and write each tab as a separate .ump file so
	// cross-tab `use` statements resolve correctly.
	if len(req.Tabs) > 0 {
		meta := make([]model.TabMeta, len(req.Tabs))
		files := make(map[string]string, len(req.Tabs))
		for i, t := range req.Tabs {
			safe := model.EnsureUmpExt(t.Name) // already validated above
			meta[i] = model.TabMeta{ID: t.ID, Name: safe}
			files[safe] = t.Code
		}
		if err := h.store.SaveTabs(modelID, &model.TabsData{
			ActiveTabID: req.ActiveTabID,
			EntryFile:   entryFile,
			Tabs:        meta,
		}); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to save tabs: %v", err))
			return
		}
		if err := h.store.SaveTabFiles(modelID, files, entryFile); err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to write tab files: %v", err))
			return
		}
	}

	// Compile to JSON using umplesync
	command := fmt.Sprintf("-generate Json %s/%s", dir, entryFile)
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

	resp := CompileResponse{
		Result:  jsonOutput,
		Errors:  result.Errors,
		ModelID: modelID,
	}

	// If a diagramType was provided, generate the diagram in the same request
	if req.DiagramType != "" {
		needsLayout := req.NeedsLayout == nil || *req.NeedsLayout

		diagResp, errMsg := processDiagram(processDiagramParams{
			pool:        h.pool,
			dir:         dir,
			modelID:     modelID,
			diagramType: req.DiagramType,
			suboptions:  req.Suboptions,
			needsLayout: needsLayout,
			entryFile:   entryFile,
		})
		if errMsg != "" {
			log.Printf("diagram generation failed during compile: %s", errMsg)
			// Don't fail the whole request — return compile result with diagram error appended
			if resp.Errors != "" {
				resp.Errors += "\n" + errMsg
			} else {
				resp.Errors = errMsg
			}
		} else {
			resp.SVG = diagResp.SVG
			resp.HTML = diagResp.HTML
			resp.Layout = diagResp.Layout
			resp.StoredLayout = diagResp.StoredLayout
			// Merge diagram errors if any
			if diagResp.Errors != "" {
				if resp.Errors != "" {
					resp.Errors += "\n" + diagResp.Errors
				} else {
					resp.Errors = diagResp.Errors
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
