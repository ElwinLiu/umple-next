package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/model"
)

type DiagramHandler struct {
	pool  *compiler.Pool
	store *model.Store
}

func NewDiagramHandler(pool *compiler.Pool, store *model.Store) *DiagramHandler {
	return &DiagramHandler{pool: pool, store: store}
}

type DiagramRequest struct {
	Code        string `json:"code"`
	DiagramType string `json:"diagramType"`
	ModelID     string `json:"modelId,omitempty"`
}

type DiagramResponse struct {
	SVG     string `json:"svg"`
	Errors  string `json:"errors,omitempty"`
	ModelID string `json:"modelId"`
}

// validDiagramTypes lists the Graphviz diagram types supported by umple.
var validDiagramTypes = map[string]bool{
	"GvClassDiagram":              true,
	"GvStateDiagram":              true,
	"GvFeatureDiagram":            true,
	"GvClassTraitDiagram":         true,
	"GvEntityRelationshipDiagram": true,
}

func (h *DiagramHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req DiagramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	if req.DiagramType == "" {
		writeError(w, http.StatusBadRequest, "diagramType is required")
		return
	}
	if !validDiagramTypes[req.DiagramType] {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported diagram type: %s", req.DiagramType))
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

	// Generate .gv file using umple
	command := fmt.Sprintf("-generate %s %s/model.ump", req.DiagramType, dir)
	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("diagram generation failed: %v", err))
		return
	}

	// Find the generated .gv file
	gvFile := ""
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".gv") {
			gvFile = filepath.Join(dir, e.Name())
			break
		}
	}

	if gvFile == "" {
		writeError(w, http.StatusInternalServerError, "no diagram output generated")
		return
	}

	// Run dot to convert .gv to SVG
	svgFile := filepath.Join(dir, "diagram.svg")
	dotCmd := exec.Command("dot", "-Tsvg", "-o", svgFile, gvFile)
	dotCmd.Dir = dir
	if dotOutput, err := dotCmd.CombinedOutput(); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("dot conversion failed: %v: %s", err, string(dotOutput)))
		return
	}

	svgData, err := os.ReadFile(svgFile)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read SVG output")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DiagramResponse{
		SVG:     string(svgData),
		Errors:  result.Errors,
		ModelID: modelID,
	})
}
