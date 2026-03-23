package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/model"
)

type SyncHandler struct {
	pool  *compiler.Pool
	store *model.Store

	modelMu sync.Map
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

const modelDelimiter = "//$?[End_of_model]$?"

// validSyncActions lists the actions currently used by the frontend.
// The adapter below translates them into the raw legacy umplesync commands.
var validSyncActions = map[string]bool{
	"addClass":             true,
	"editClass":            true,
	"editPosition":         true,
	"addAssociation":       true,
	"removeAssociation":    true,
	"editAssociation":      true,
	"addGeneralization":    true,
	"removeGeneralization": true,
	"addAttribute":         true,
	"removeAttribute":      true,
	"addMethod":            true,
	"removeMethod":         true,
	"addInterface":         true,
	"removeClass":          true,
}

type syncPosition struct {
	X      any `json:"x"`
	Y      any `json:"y"`
	Width  any `json:"width"`
	Height any `json:"height"`
}

type syncAttribute struct {
	Type       string `json:"type"`
	Name       string `json:"name"`
	Modifier   string `json:"modifier,omitempty"`
	TraceColor string `json:"traceColor,omitempty"`
	NewType    string `json:"newType,omitempty"`
	NewName    string `json:"newName,omitempty"`
	DeleteType string `json:"deleteType,omitempty"`
	DeleteName string `json:"deleteName,omitempty"`
	OldType    string `json:"oldType,omitempty"`
	OldName    string `json:"oldName,omitempty"`
}

type syncMethod struct {
	Visibility       string `json:"visibility,omitempty"`
	IsAbstract       string `json:"isAbstract,omitempty"`
	Type             string `json:"type"`
	Name             string `json:"name"`
	Parameters       any    `json:"parameters,omitempty"`
	NewVisibility    string `json:"newVisibility,omitempty"`
	NewType          string `json:"newType,omitempty"`
	NewName          string `json:"newName,omitempty"`
	NewParameters    any    `json:"newParameters,omitempty"`
	DeleteVisibility string `json:"deleteVisibility,omitempty"`
	DeleteType       string `json:"deleteType,omitempty"`
	DeleteName       string `json:"deleteName,omitempty"`
	DeleteParameters any    `json:"deleteParameters,omitempty"`
	OldVisibility    string `json:"oldVisibility,omitempty"`
	OldType          string `json:"oldType,omitempty"`
	OldName          string `json:"oldName,omitempty"`
	OldParameters    any    `json:"oldParameters,omitempty"`
}

type syncClass struct {
	Position     syncPosition    `json:"position"`
	Attributes   []syncAttribute `json:"attributes"`
	Methods      []syncMethod    `json:"methods"`
	Interfaces   []string        `json:"interfaces,omitempty"`
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	OldName      string          `json:"oldname,omitempty"`
	ExtendsClass string          `json:"extendsClass,omitempty"`
	IsInterface  string          `json:"isInterface"`
	IsAbstract   string          `json:"isAbstract"`
	DisplayColor string          `json:"displayColor"`
}

type syncAssociation struct {
	ClassOnePosition     syncPosition `json:"classOnePosition,omitempty"`
	ClassTwoPosition     syncPosition `json:"classTwoPosition,omitempty"`
	OffsetOnePosition    syncPosition `json:"offsetOnePosition,omitempty"`
	OffsetTwoPosition    syncPosition `json:"offsetTwoPosition,omitempty"`
	ID                   string       `json:"id,omitempty"`
	ClassOneID           string       `json:"classOneId,omitempty"`
	ClassTwoID           string       `json:"classTwoId,omitempty"`
	Name                 string       `json:"name,omitempty"`
	MultiplicityOne      string       `json:"multiplicityOne,omitempty"`
	MultiplicityTwo      string       `json:"multiplicityTwo,omitempty"`
	RoleOne              string       `json:"roleOne,omitempty"`
	RoleTwo              string       `json:"roleTwo,omitempty"`
	IsLeftNavigable      string       `json:"isLeftNavigable,omitempty"`
	IsRightNavigable     string       `json:"isRightNavigable,omitempty"`
	IsLeftComposition    string       `json:"isLeftComposition,omitempty"`
	IsRightComposition   string       `json:"isRightComposition,omitempty"`
	IsSymmetricReflexive string       `json:"isSymmetricReflexive,omitempty"`
	Color                string       `json:"color,omitempty"`
	IsTraced             string       `json:"isTraced,omitempty"`
}

type syncModel struct {
	UmpleClasses      []syncClass       `json:"umpleClasses"`
	UmpleAssociations []syncAssociation `json:"umpleAssociations"`
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
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create model dir")
		return
	}
	modelMu := h.getModelMutex(dir)
	modelMu.Lock()
	defer modelMu.Unlock()

	umpFile := filepath.Join(dir, "model.ump")
	if err := ensureDelimitedModelFile(umpFile); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to prepare model")
		return
	}
	command, err := h.buildLegacySyncCommand(req, umpFile, dir)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("sync failed: %v", err))
		return
	}
	if isFatalSyncOutput(result.Output) {
		writeError(w, http.StatusBadRequest, strings.TrimSpace(result.Output))
		return
	}

	// umplesync returns the full updated model on stdout (including the
	// delimiter and position metadata). Write it to disk so the file
	// stays in sync, then strip the delimiter for the frontend.
	fullOutput := result.Output
	if strings.TrimSpace(fullOutput) != "" {
		if err := os.WriteFile(umpFile, []byte(fullOutput), 0o644); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to persist synced model")
			return
		}
	} else if data, err := os.ReadFile(umpFile); err == nil {
		fullOutput = string(data)
	}
	code := stripModelDelimiter(fullOutput)

	jsonModel, err := h.generateModelJSON(umpFile, dir)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SyncResponse{
		Code:    code,
		Result:  string(jsonModel),
		Errors:  result.Errors,
		ModelID: modelID,
	})
}

func (h *SyncHandler) getModelMutex(modelDir string) *sync.Mutex {
	val, _ := h.modelMu.LoadOrStore(modelDir, &sync.Mutex{})
	return val.(*sync.Mutex)
}

func ensureDelimitedModelFile(umpFile string) error {
	data, err := os.ReadFile(umpFile)
	if err != nil {
		if os.IsNotExist(err) {
			return os.WriteFile(umpFile, []byte(modelDelimiter), 0o644)
		}
		return err
	}

	content := string(data)
	if strings.Contains(content, modelDelimiter) {
		return nil
	}

	content = strings.TrimRight(content, "\n")
	if content == "" {
		content = modelDelimiter
	} else {
		content += "\n" + modelDelimiter + "\n"
	}
	return os.WriteFile(umpFile, []byte(content), 0o644)
}

func (h *SyncHandler) buildLegacySyncCommand(req SyncRequest, umpFile string, dir string) (string, error) {
	switch req.Action {
	case "addClass":
		payload, err := json.Marshal(syncClass{
			Position: syncPosition{
				X:      req.Params["x"],
				Y:      req.Params["y"],
				Width:  "109",
				Height: "41",
			},
			Attributes:   []syncAttribute{},
			Methods:      []syncMethod{},
			Interfaces:   []string{},
			ID:           req.Params["className"],
			Name:         req.Params["className"],
			IsInterface:  "false",
			IsAbstract:   "false",
			DisplayColor: "transparent",
		})
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("addClass", payload, umpFile), nil
	case "addAssociation":
		assoc := syncAssociation{
			ClassOnePosition: syncPosition{},
			ClassTwoPosition: syncPosition{},
			OffsetOnePosition: syncPosition{
				X:      "0",
				Y:      "0",
				Width:  "0",
				Height: "0",
			},
			OffsetTwoPosition: syncPosition{
				X:      "0",
				Y:      "0",
				Width:  "0",
				Height: "0",
			},
			ID:                   "umpleAssociation_0",
			ClassOneID:           req.Params["classOneId"],
			ClassTwoID:           req.Params["classTwoId"],
			Name:                 req.Params["classOneId"] + "__" + req.Params["classTwoId"],
			MultiplicityOne:      "*",
			MultiplicityTwo:      "*",
			RoleOne:              "",
			RoleTwo:              "",
			IsLeftNavigable:      "true",
			IsRightNavigable:     "true",
			IsLeftComposition:    "false",
			IsRightComposition:   "false",
			IsSymmetricReflexive: "false",
			Color:                "black",
		}

		model, err := h.loadCurrentModel(umpFile, dir)
		if err == nil {
			if cls := findClass(model.UmpleClasses, assoc.ClassOneID); cls != nil {
				assoc.ClassOnePosition = cls.Position
			}
			if cls := findClass(model.UmpleClasses, assoc.ClassTwoID); cls != nil {
				assoc.ClassTwoPosition = cls.Position
			}
			assoc.ID = fmt.Sprintf("umpleAssociation_%d", len(model.UmpleAssociations))
		}

		payload, err := json.Marshal(assoc)
		if err != nil {
			return "", fmt.Errorf("failed to encode association payload")
		}
		return rawSyncCommand("addAssociation", payload, umpFile), nil
	case "addGeneralization":
		model, err := h.loadCurrentModel(umpFile, dir)
		if err != nil {
			return "", err
		}
		child := findClass(model.UmpleClasses, req.Params["childClass"])
		parent := findClass(model.UmpleClasses, req.Params["parentClass"])
		if child == nil || parent == nil {
			return "", fmt.Errorf("class not found for generalization")
		}

		payload, err := json.Marshal(map[string]any{
			"childId":        child.Name,
			"parentId":       parent.Name,
			"childPosition":  child.Position,
			"parentPosition": parent.Position,
		})
		if err != nil {
			return "", fmt.Errorf("failed to encode generalization payload")
		}
		return rawSyncCommand("addGeneralization", payload, umpFile), nil
	}

	model, err := h.loadCurrentModel(umpFile, dir)
	if err != nil {
		return "", err
	}

	switch req.Action {
	case "editClass":
		className := req.Params["className"]
		newName := req.Params["newName"]
		cls := findClass(model.UmpleClasses, className)
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", className)
		}

		cls.OldName = cls.Name
		cls.Name = newName
		cls.ID = newName
		cls.Position.Width = "109"

		for i := range model.UmpleAssociations {
			if model.UmpleAssociations[i].ClassOneID == className {
				model.UmpleAssociations[i].ClassOneID = newName
			}
			if model.UmpleAssociations[i].ClassTwoID == className {
				model.UmpleAssociations[i].ClassTwoID = newName
			}
		}
		for i := range model.UmpleClasses {
			if model.UmpleClasses[i].ExtendsClass == className {
				model.UmpleClasses[i].ExtendsClass = newName
			}
		}

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("editClass", payload, umpFile), nil
	case "editPosition":
		cls := findClass(model.UmpleClasses, req.Params["className"])
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", req.Params["className"])
		}
		cls.Position.X = req.Params["x"]
		cls.Position.Y = req.Params["y"]

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("editClass", payload, umpFile), nil
	case "addAttribute":
		cls := findClass(model.UmpleClasses, req.Params["className"])
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", req.Params["className"])
		}

		attrType := req.Params["attributeType"]
		if attrType == "" {
			attrType = "String"
		}
		cls.Attributes = append(cls.Attributes, syncAttribute{
			Type:       attrType,
			Name:       req.Params["attributeName"],
			Modifier:   "",
			TraceColor: "black",
			NewType:    attrType,
			NewName:    req.Params["attributeName"],
		})

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("editClass", payload, umpFile), nil
	case "removeAttribute":
		cls := findClass(model.UmpleClasses, req.Params["className"])
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", req.Params["className"])
		}

		// umplesync's EditAction expects a minimal attribute object with
		// only "deleteName" to signal deletion.
		cls.Attributes = []syncAttribute{{
			DeleteName: req.Params["attributeName"],
		}}

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("editClass", payload, umpFile), nil
	case "addMethod":
		cls := findClass(model.UmpleClasses, req.Params["className"])
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", req.Params["className"])
		}

		methodType := req.Params["methodType"]
		if methodType == "" {
			methodType = "void"
		}
		parameters := parseMethodParameters(req.Params["methodParameters"])
		cls.Methods = append(cls.Methods, syncMethod{
			Visibility:    "public",
			IsAbstract:    "",
			Type:          methodType,
			Name:          req.Params["methodName"],
			Parameters:    parameters,
			NewVisibility: "public",
			NewType:       methodType,
			NewName:       req.Params["methodName"],
			NewParameters: parameters,
		})

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("editClass", payload, umpFile), nil
	case "removeMethod":
		cls := findClass(model.UmpleClasses, req.Params["className"])
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", req.Params["className"])
		}

		// umplesync's EditAction expects a minimal method object with
		// only "deleteName" to signal deletion.
		cls.Methods = []syncMethod{{
			DeleteName: req.Params["methodName"],
		}}

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("editClass", payload, umpFile), nil
	case "removeClass":
		cls := findClass(model.UmpleClasses, req.Params["className"])
		if cls == nil {
			return "", fmt.Errorf("class not found: %s", req.Params["className"])
		}

		payload, err := json.Marshal(cls)
		if err != nil {
			return "", fmt.Errorf("failed to encode class payload")
		}
		return rawSyncCommand("removeClass", payload, umpFile), nil
	case "removeAssociation", "editAssociation":
		assoc := findAssociation(model.UmpleAssociations, req.Params["classOneId"], req.Params["classTwoId"], req.Params["assocId"])
		if assoc == nil {
			return "", fmt.Errorf("association not found")
		}

		payload, err := json.Marshal(assoc)
		if err != nil {
			return "", fmt.Errorf("failed to encode association payload")
		}
		return rawSyncCommand(req.Action, payload, umpFile), nil
	case "removeGeneralization":
		payload, err := json.Marshal(map[string]any{
			"childId": req.Params["childClass"],
		})
		if err != nil {
			return "", fmt.Errorf("failed to encode generalization payload")
		}
		return rawSyncCommand("removeGeneralization", payload, umpFile), nil
	case "addInterface":
		return "", fmt.Errorf("addInterface not implemented")
	default:
		return "", fmt.Errorf("unsupported action: %s", req.Action)
	}
}

func (h *SyncHandler) loadCurrentModel(umpFile string, dir string) (*syncModel, error) {
	data, err := h.generateModelJSON(umpFile, dir)
	if err != nil {
		return nil, err
	}

	var model syncModel
	if err := json.Unmarshal(data, &model); err != nil {
		return nil, fmt.Errorf("failed to parse current model JSON")
	}

	for i := range model.UmpleClasses {
		if model.UmpleClasses[i].DisplayColor == "" {
			model.UmpleClasses[i].DisplayColor = "transparent"
		}
		if model.UmpleClasses[i].Interfaces == nil {
			model.UmpleClasses[i].Interfaces = []string{}
		}
	}

	return &model, nil
}

func (h *SyncHandler) generateModelJSON(umpFile string, dir string) ([]byte, error) {
	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: fmt.Sprintf("-generate Json %s", umpFile),
		WorkDir: dir,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load current model: %v", err)
	}
	if result.Errors != "" {
		return nil, fmt.Errorf("failed to load current model: %s", result.Errors)
	}

	data, err := os.ReadFile(filepath.Join(dir, "model.json"))
	if err == nil {
		return data, nil
	}
	if result.Output == "" {
		return nil, fmt.Errorf("failed to load current model JSON")
	}
	return []byte(result.Output), nil
}

func rawSyncCommand(action string, payload []byte, umpFile string) string {
	return fmt.Sprintf("-%s %s %s", action, strconv.Quote(string(payload)), umpFile)
}

func isFatalSyncOutput(output string) bool {
	return strings.Contains(output, "FATAL ERROR PARSING UMPLE DIAGRAM")
}

// stripModelDelimiter removes the umplesync end-of-model marker and any
// position metadata that follows it.  The on-disk model.ump keeps both
// sections so umplesync can round-trip positions, but the editor should
// only ever see the user-authored Umple code.
func stripModelDelimiter(code string) string {
	if idx := strings.Index(code, modelDelimiter); idx >= 0 {
		code = code[:idx]
	}
	return strings.TrimRight(code, "\n") + "\n"
}

func parseMethodParameters(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	parts := strings.Split(raw, ",")
	params := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			params = append(params, trimmed)
		}
	}
	return params
}

func findClass(classes []syncClass, name string) *syncClass {
	for i := range classes {
		if classes[i].Name == name || classes[i].ID == name {
			return &classes[i]
		}
	}
	return nil
}

func findAssociation(associations []syncAssociation, classOneID string, classTwoID string, assocID string) *syncAssociation {
	// Prefer matching by unique association ID (disambiguates parallel associations)
	if assocID != "" {
		for i := range associations {
			if associations[i].ID == assocID {
				return &associations[i]
			}
		}
	}
	// Fallback: match by endpoint classes (first match)
	for i := range associations {
		a := &associations[i]
		if a.ClassOneID == classOneID && a.ClassTwoID == classTwoID {
			return a
		}
		if a.ClassOneID == classTwoID && a.ClassTwoID == classOneID {
			return a
		}
	}
	return nil
}
