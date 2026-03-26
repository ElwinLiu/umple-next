package handlers

import (
	_ "embed"
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
	Code        string   `json:"code"`
	DiagramType string   `json:"diagramType"`
	ModelID     string   `json:"modelId,omitempty"`
	Suboptions  []string `json:"suboptions,omitempty"`
}

type GvTextLine struct {
	Text string `json:"text"`
	Bold bool   `json:"bold,omitempty"`
}

type GvPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type GvNodeLayout struct {
	Name      string       `json:"name"`
	X         float64      `json:"x"`
	Y         float64      `json:"y"`
	Width     float64      `json:"width"`
	Height    float64      `json:"height"`
	Shape     string       `json:"shape,omitempty"`
	TextLines []GvTextLine `json:"textLines,omitempty"`
}

type GvEdgeLayout struct {
	Source       string   `json:"source"`
	Target       string   `json:"target"`
	Label        string   `json:"label,omitempty"`
	HeadLabel    string   `json:"headLabel,omitempty"`
	TailLabel    string   `json:"tailLabel,omitempty"`
	Points       []GvPoint `json:"points,omitempty"`
	LabelPos     *GvPoint `json:"labelPos,omitempty"`
	HeadLabelPos *GvPoint `json:"headLabelPos,omitempty"`
	TailLabelPos *GvPoint `json:"tailLabelPos,omitempty"`
}

type GvLayout struct {
	BBoxWidth  float64        `json:"bboxWidth"`
	BBoxHeight float64        `json:"bboxHeight"`
	Nodes      []GvNodeLayout `json:"nodes"`
	Edges      []GvEdgeLayout `json:"edges,omitempty"`
}

type DiagramResponse struct {
	SVG     string      `json:"svg"`
	HTML    string      `json:"html,omitempty"`
	Layout  *GvLayout   `json:"layout,omitempty"`
	Errors  string      `json:"errors,omitempty"`
	ModelID string      `json:"modelId"`
}

//go:embed assets/structureDiagram.js
var structureDiagramRuntime string

// Graphviz JSON output structures (subset we care about).
type gvJSON struct {
	BB      string     `json:"bb"`
	Objects []gvObject `json:"objects"`
	Edges   []gvEdge   `json:"edges"`
}

type gvObject struct {
	GvID    int            `json:"_gvid"`
	Name    string         `json:"name"`
	Pos     string         `json:"pos"`
	Width   string         `json:"width"`
	Height  string         `json:"height"`
	Shape   string         `json:"shape"`
	Label   string         `json:"label"`
	LDraw   []gvDrawOp     `json:"_ldraw_"`
	Objects []gvObject     `json:"objects"` // nested subgraph nodes
}

type gvEdge struct {
	Tail      int        `json:"tail"`
	Head      int        `json:"head"`
	Label     string     `json:"label"`
	HeadLabel string     `json:"headlabel"`
	TailLabel string     `json:"taillabel"`
	Pos       string     `json:"pos"`
	LP        string     `json:"lp"`
	HeadLP    string     `json:"head_lp"`
	TailLP    string     `json:"tail_lp"`
	Draw      []gvDrawOp `json:"_draw_"`
}

type gvDrawOp struct {
	Op     string      `json:"op"`
	Text   string      `json:"text,omitempty"`
	Face   string      `json:"face,omitempty"`
	Size   float64     `json:"size,omitempty"`
	Points [][]float64 `json:"points,omitempty"`
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

	// Build _gvid → name lookup for edge resolution
	idToName := map[int]string{}

	// Flatten objects recursively (subgraphs may nest nodes)
	var flatten func(objects []gvObject)
	flatten = func(objects []gvObject) {
		for _, obj := range objects {
			if obj.Pos != "" {
				idToName[obj.GvID] = obj.Name

				posParts := strings.Split(obj.Pos, ",")
				if len(posParts) >= 2 {
					gvX, _ := strconv.ParseFloat(posParts[0], 64)
					gvY, _ := strconv.ParseFloat(posParts[1], 64)
					w, _ := strconv.ParseFloat(obj.Width, 64)
					h, _ := strconv.ParseFloat(obj.Height, 64)

					layout.Nodes = append(layout.Nodes, GvNodeLayout{
						Name:      obj.Name,
						X:         gvX * ptToPx,
						Y:         (bbHeight - gvY) * ptToPx, // flip Y axis
						Width:     w * 72 * ptToPx,            // inches → points → pixels
						Height:    h * 72 * ptToPx,
						Shape:     obj.Shape,
						TextLines: extractTextLines(obj.LDraw),
					})
				}
			}
			if len(obj.Objects) > 0 {
				flatten(obj.Objects)
			}
		}
	}
	flatten(gv.Objects)

	// Extract edges
	for _, e := range gv.Edges {
		src, ok1 := idToName[e.Tail]
		tgt, ok2 := idToName[e.Head]
		if !ok1 || !ok2 {
			continue
		}
		layout.Edges = append(layout.Edges, GvEdgeLayout{
			Source:       src,
			Target:       tgt,
			Label:        e.Label,
			HeadLabel:    e.HeadLabel,
			TailLabel:    e.TailLabel,
			Points:       extractEdgePoints(e.Draw, bbHeight),
			LabelPos:     parseEdgePoint(e.LP, bbHeight),
			HeadLabelPos: parseEdgePoint(e.HeadLP, bbHeight),
			TailLabelPos: parseEdgePoint(e.TailLP, bbHeight),
		})
	}

	return layout
}

func extractEdgePoints(ops []gvDrawOp, bbHeight float64) []GvPoint {
	for _, op := range ops {
		if op.Op != "b" || len(op.Points) == 0 {
			continue
		}

		points := make([]GvPoint, 0, len(op.Points))
		for _, pt := range op.Points {
			if len(pt) < 2 {
				continue
			}
			points = append(points, GvPoint{
				X: pt[0] * ptToPx,
				Y: (bbHeight - pt[1]) * ptToPx,
			})
		}
		return points
	}
	return nil
}

func parseEdgePoint(pos string, bbHeight float64) *GvPoint {
	if pos == "" {
		return nil
	}
	parts := strings.Split(pos, ",")
	if len(parts) < 2 {
		return nil
	}
	x, errX := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	y, errY := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if errX != nil || errY != nil {
		return nil
	}
	return &GvPoint{
		X: x * ptToPx,
		Y: (bbHeight - y) * ptToPx,
	}
}

// extractTextLines pulls visible text from _ldraw_ draw operations.
// The preceding F (font) operation tells us the face; names containing
// "Bold" indicate a bold line (used for node titles).
func extractTextLines(ops []gvDrawOp) []GvTextLine {
	var lines []GvTextLine
	var curFace string
	for _, op := range ops {
		switch op.Op {
		case "F":
			curFace = op.Face
		case "T":
			if text := strings.TrimSpace(op.Text); text != "" {
				bold := strings.Contains(strings.ToLower(curFace), "bold")
				lines = append(lines, GvTextLine{Text: text, Bold: bold})
			}
		}
	}
	return lines
}

// validSuboptions lists the allowed -s flags for umplesync.jar diagram generation.
var validSuboptions = map[string]bool{
	"hideattributes":       true,
	"showmethods":          true,
	"hideactions":          true,
	"showtransitionlabels": true,
	"hideguards":           true,
	"showguardlabels":      true,
	"hidenaturallanguage":  true,
	"showFeatureDependency": true,
	"gvdot":                true,
	"gvsfdp":               true,
	"gvcirco":              true,
	"gvneato":              true,
	"gvfdp":                true,
	"gvtwopi":              true,
	"gvdark":               true,
}

type diagramOutputKind int

const (
	outputGV   diagramOutputKind = iota
	outputHTML
)

// diagramTypeInfo classifies each supported diagram type by its output kind.
// GV types produce .gv files processed through dot; HTML types return HTML on stdout.
var diagramTypeInfo = map[string]diagramOutputKind{
	"GvClassDiagram":              outputGV,
	"GvStateDiagram":              outputGV,
	"GvFeatureDiagram":            outputGV,
	"GvClassTraitDiagram":         outputGV,
	"StructureDiagram":            outputHTML,
	"GvEntityRelationshipDiagram": outputGV,
	"InstanceDiagram":             outputGV,
	"EventSequence":               outputHTML,
	"StateTables":                 outputHTML,
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
	outputKind, ok := diagramTypeInfo[req.DiagramType]
	if !ok {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported diagram type: %s", req.DiagramType))
		return
	}

	// Ensure model directory exists
	modelID, dir, err := resolveModel(h.store, req.ModelID, req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to resolve model: %v", err))
		return
	}

	// Remove stale .gv files so the directory scan after generation
	// always picks the newly generated file, not a leftover from a
	// previous diagram type.
	if cleanEntries, err := os.ReadDir(dir); err == nil {
		for _, e := range cleanEntries {
			if strings.HasSuffix(e.Name(), ".gv") {
				if removeErr := os.Remove(filepath.Join(dir, e.Name())); removeErr != nil {
					log.Printf("warning: failed to remove stale .gv file %s: %v", e.Name(), removeErr)
				}
			}
		}
	}

	// Generate .gv file using umple, appending validated suboptions as -s flags
	command := fmt.Sprintf("-generate %s %s/model.ump", req.DiagramType, dir)
	for _, opt := range req.Suboptions {
		if validSuboptions[opt] {
			command += " -s " + opt
		}
	}
	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("diagram generation failed: %v", err))
		return
	}

	// HTML output types (EventSequence, StateTables): prefer socket output,
	// but fall back to reading model.html from disk (Umple may write there instead).
	if outputKind == outputHTML {
		html := result.Output
		if strings.TrimSpace(html) == "" {
			htmlPath := filepath.Join(dir, "model.html")
			if data, readErr := os.ReadFile(htmlPath); readErr == nil {
				html = string(data)
			}
		}
		if req.DiagramType == "StructureDiagram" {
			html = buildStructureDiagramHTML(html)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(DiagramResponse{
			HTML:    html,
			Errors:  result.Errors,
			ModelID: modelID,
		})
		return
	}

	// GV output types: find the generated .gv file and run dot
	gvFile := ""
	entries, err := os.ReadDir(dir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read model directory: "+err.Error())
		return
	}
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
		SVG:     string(svgData),
		Layout:  layout,
		Errors:  result.Errors,
		ModelID: modelID,
	})
}

func buildStructureDiagramHTML(generated string) string {
	script := strings.TrimSpace(generated)
	if script == "" {
		return ""
	}

	script = strings.ReplaceAll(script, "##CANVAS_ID##", "svgCanvas")

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body { margin: 0; padding: 0; width: 100%%; height: 100%%; overflow: auto; background: transparent; }
    #structure-root { width: 100%%; min-height: 100%%; display: flex; align-items: flex-start; justify-content: center; padding: 16px; box-sizing: border-box; }
    #svgCanvas { max-width: 100%%; }
  </style>
</head>
<body>
  <div id="structure-root">
    <svg id="svgCanvas" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <script>%s</script>
  <script>%s</script>
</body>
</html>`, structureDiagramRuntime, script)
}
