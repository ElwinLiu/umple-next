package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/gvparse"
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

type GvNodeLayout struct {
	Name   string  `json:"name"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type GvLayout struct {
	BBoxWidth  float64        `json:"bboxWidth"`
	BBoxHeight float64        `json:"bboxHeight"`
	Nodes      []GvNodeLayout `json:"nodes"`
}

type DiagramResponse struct {
	SVG           string                 `json:"svg"`
	Layout        *GvLayout              `json:"layout,omitempty"`
	StateMachines []gvparse.StateMachine `json:"stateMachines,omitempty"`
	Errors        string                 `json:"errors,omitempty"`
	ModelID       string                 `json:"modelId"`
}

// Graphviz JSON output structures (subset we care about).
type gvJSON struct {
	BB      string     `json:"bb"`
	Objects []gvObject `json:"objects"`
}

type gvObject struct {
	Name    string     `json:"name"`
	Pos     string     `json:"pos"`
	Width   string     `json:"width"`
	Height  string     `json:"height"`
	Objects []gvObject `json:"objects"` // nested subgraph nodes
}

const ptToPx = 96.0 / 72.0

func parseGvLayout(jsonData []byte) *GvLayout {
	var gv gvJSON
	if err := json.Unmarshal(jsonData, &gv); err != nil {
		return nil
	}

	bbParts := strings.Split(gv.BB, ",")
	if len(bbParts) < 4 {
		return nil
	}
	bbHeight, _ := strconv.ParseFloat(bbParts[3], 64)
	bbWidth, _ := strconv.ParseFloat(bbParts[2], 64)

	layout := &GvLayout{
		BBoxWidth:  bbWidth * ptToPx,
		BBoxHeight: bbHeight * ptToPx,
	}

	// Flatten objects recursively (subgraphs may nest nodes)
	var flatten func(objects []gvObject)
	flatten = func(objects []gvObject) {
		for _, obj := range objects {
			if obj.Pos != "" {
				posParts := strings.Split(obj.Pos, ",")
				if len(posParts) >= 2 {
					gvX, _ := strconv.ParseFloat(posParts[0], 64)
					gvY, _ := strconv.ParseFloat(posParts[1], 64)
					w, _ := strconv.ParseFloat(obj.Width, 64)
					h, _ := strconv.ParseFloat(obj.Height, 64)

					layout.Nodes = append(layout.Nodes, GvNodeLayout{
						Name:   obj.Name,
						X:      gvX * ptToPx,
						Y:      (bbHeight - gvY) * ptToPx, // flip Y axis
						Width:  w * 72 * ptToPx,            // inches → points → pixels
						Height: h * 72 * ptToPx,
					})
				}
			}
			if len(obj.Objects) > 0 {
				flatten(obj.Objects)
			}
		}
	}
	flatten(gv.Objects)

	return layout
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

	// Remove stale .gv files so the directory scan after generation
	// always picks the newly generated file, not a leftover from a
	// previous diagram type.
	if cleanEntries, err := os.ReadDir(dir); err == nil {
		for _, e := range cleanEntries {
			if strings.HasSuffix(e.Name(), ".gv") {
				os.Remove(filepath.Join(dir, e.Name()))
			}
		}
	}

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

	// Parse state machine structure from GV file (fast, before dot runs)
	var stateMachines []gvparse.StateMachine
	if req.DiagramType == "GvStateDiagram" {
		if gvContent, err := os.ReadFile(gvFile); err == nil {
			var parseErr error
			stateMachines, parseErr = gvparse.ParseStateDiagram(string(gvContent))
			if parseErr != nil {
				log.Printf("gvparse: state machine parsing failed: %v", parseErr)
			}
		}
	}

	// Run dot -Tsvg and dot -Tjson concurrently (independent operations on the same .gv input)
	var (
		svgData    []byte
		layout     *GvLayout
		svgErr     error
		svgErrMsg  string
	)

	var wg sync.WaitGroup
	wg.Add(2)

	// SVG generation
	go func() {
		defer wg.Done()
		svgFile := filepath.Join(dir, "diagram.svg")
		cmd := exec.Command("dot", "-Tsvg", "-o", svgFile, gvFile)
		cmd.Dir = dir
		if out, err := cmd.CombinedOutput(); err != nil {
			svgErr = err
			svgErrMsg = string(out)
			return
		}
		svgData, svgErr = os.ReadFile(svgFile)
	}()

	// JSON layout extraction (capture stdout directly, no temp file)
	go func() {
		defer wg.Done()
		cmd := exec.Command("dot", "-Tjson", gvFile)
		cmd.Dir = dir
		if jsonData, err := cmd.Output(); err == nil {
			layout = parseGvLayout(jsonData)
		}
	}()

	wg.Wait()

	if svgErr != nil {
		if svgErrMsg != "" {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("dot conversion failed: %v: %s", svgErr, svgErrMsg))
		} else {
			writeError(w, http.StatusInternalServerError, "failed to read SVG output")
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DiagramResponse{
		SVG:           string(svgData),
		Layout:        layout,
		StateMachines: stateMachines,
		Errors:        result.Errors,
		ModelID:       modelID,
	})
}
