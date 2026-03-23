package handlers

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/config"
	"github.com/umple/umple-next/backend/internal/model"
)

//go:embed javadoc_theme.css
var javadocThemeCSS []byte

type GenerateHandler struct {
	pool    *compiler.Pool
	store   *model.Store
	jarPath string // resolved once at init
}

func NewGenerateHandler(pool *compiler.Pool, store *model.Store, cfg *config.Config) *GenerateHandler {
	jarPath := cfg.UmpleSyncJar
	if _, err := os.Stat(jarPath); err != nil {
		jarPath = cfg.UmpleJar
	}
	return &GenerateHandler{pool: pool, store: store, jarPath: jarPath}
}

type GenerateRequest struct {
	Code     string `json:"code"`
	Language string `json:"language"`
	ModelID  string `json:"modelId,omitempty"`
}

type GeneratedArtifact struct {
	Label    string `json:"label"`
	URL      string `json:"url"`
	Filename string `json:"filename,omitempty"`
}

type GenerateResponse struct {
	Output    string              `json:"output"`
	Language  string              `json:"language"`
	Errors    string              `json:"errors,omitempty"`
	ModelID   string              `json:"modelId"`
	Kind      string              `json:"kind,omitempty"`
	HTML      string              `json:"html,omitempty"`
	IframeURL string              `json:"iframeUrl,omitempty"`
	Downloads []GeneratedArtifact `json:"downloads,omitempty"`
}

var validGenerateLanguages = map[string]bool{
	"Java":                        true,
	"javadoc":                     true,
	"Php":                         true,
	"Python":                      true,
	"Ruby":                        true,
	"Cpp":                         true,
	"RTCpp":                       true,
	"SimpleCpp":                   true,
	"Json":                        true,
	"Yuml":                        true,
	"Mermaid":                     true,
	"Ecore":                       true,
	"Papyrus":                     true,
	"TextUml":                     true,
	"Scxml":                       true,
	"Umlet":                       true,
	"USE":                         true,
	"Sql":                         true,
	"Alloy":                       true,
	"NuSMV":                       true,
	"SimulateJava":                true,
	"SimpleMetrics":               true,
	"PlainRequirementsDoc":        true,
	"CodeAnalysis":                true,
	"UmpleSelf":                   true,
	"UmpleAnnotaiveToComposition": true,
}

var htmlGenerateLanguages = map[string]bool{
	"SimpleMetrics":        true,
	"PlainRequirementsDoc": true,
	"CodeAnalysis":         true,
}

func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
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

	baseLanguage, suboptions := parseGenerateLanguage(req.Language)
	if !validGenerateLanguages[baseLanguage] {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported language: %s", baseLanguage))
		return
	}

	modelID, dir, err := h.resolveModelDir(req.ModelID, req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Acquire per-model lock BEFORE writing model.ump so we don't race
	// with compile/diagram/execute requests on the same directory.
	h.pool.LockModel(dir)
	defer h.pool.UnlockModel(dir)

	if err := h.writeModelFile(dir, req.Code); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var resp GenerateResponse
	switch baseLanguage {
	case "javadoc":
		resp, err = h.generateJavadoc(dir, modelID)
	case "Yuml":
		resp, err = h.generateYuml(dir, modelID)
	default:
		resp, err = h.generateGeneric(baseLanguage, dir, modelID, suboptions)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// resolveModelDir returns the modelID and directory without writing model.ump.
// For new models (empty ID), it creates a fresh directory via store.Create.
// For existing models, it just resolves the path — the caller writes under the lock.
func (h *GenerateHandler) resolveModelDir(modelID, code string) (string, string, error) {
	if modelID == "" {
		// New model: store.Create generates a unique ID nobody else knows yet,
		// so the write inside Create is safe without the per-model lock.
		m, err := h.store.Create(code)
		if err != nil {
			return "", "", fmt.Errorf("failed to create model")
		}
		return m.ID, h.store.ModelDir(m.ID), nil
	}
	dir := h.store.ModelDir(modelID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", fmt.Errorf("failed to create model dir")
	}
	return modelID, dir, nil
}

// writeModelFile writes model.ump into the directory. Must be called under the per-model lock.
func (h *GenerateHandler) writeModelFile(dir, code string) error {
	return os.WriteFile(filepath.Join(dir, "model.ump"), []byte(code), 0o644)
}

func (h *GenerateHandler) generateGeneric(language, dir, modelID string, suboptions []string) (GenerateResponse, error) {
	stdout, stderr, runErr := h.runGenerateCommand(language, dir, suboptions)
	output := strings.TrimSpace(stdout)

	files, paths, err := readGeneratedFiles(dir, language)
	if err == nil && files != "" {
		output = files
	}

	if runErr != nil && strings.TrimSpace(stderr) == "" {
		stderr = runErr.Error()
	}

	resp := GenerateResponse{
		Output:   output,
		Language: language,
		Errors:   strings.TrimSpace(stderr),
		ModelID:  modelID,
		Kind:     "text",
	}

	if htmlGenerateLanguages[language] {
		resp.Kind = "html"
		resp.HTML = output
	}

	if len(paths) > 0 {
		zipName := language + "FromUmple.zip"
		if language == "Papyrus" {
			zipName = "PapyrusFromUmple.zip"
		}
		zipPath := filepath.Join(dir, zipName)
		if err := zipGeneratedArtifacts(zipPath, dir, paths); err == nil {
			resp.Downloads = append(resp.Downloads, GeneratedArtifact{
				Label:    "Download ZIP",
				URL:      buildGeneratedAssetURL(modelID, zipName),
				Filename: zipName,
			})
		}
	}

	if language == "Papyrus" && output == "" {
		resp.Output = "Papyrus project generated."
	}

	return resp, nil
}

func (h *GenerateHandler) generateJavadoc(dir, modelID string) (GenerateResponse, error) {
	stdout, stderr, runErr := h.runGenerateCommand("Java", dir, nil)
	output := strings.TrimSpace(stdout)

	files, javaFiles, err := readGeneratedFiles(dir, "Java")
	if err == nil && files != "" {
		output = files
	}

	if len(javaFiles) == 0 {
		return GenerateResponse{
			Output:   output,
			Language: "Java",
			Errors:   firstNonEmpty(strings.TrimSpace(stderr), errString(runErr), "No generated Java files found for Javadoc."),
			ModelID:  modelID,
			Kind:     "text",
		}, nil
	}

	javadocDir := filepath.Join(dir, "javadoc")
	_ = os.RemoveAll(javadocDir)
	if err := os.MkdirAll(javadocDir, 0o755); err != nil {
		return GenerateResponse{}, fmt.Errorf("create javadoc dir: %w", err)
	}

	args := append([]string{"-d", javadocDir, "-footer", "Generated by Umple"}, javaFiles...)
	javadocOut, javadocErr := exec.Command("javadoc", args...).CombinedOutput()
	javadocErrors := strings.TrimSpace(string(javadocOut))
	if javadocErr != nil && javadocErrors == "" {
		javadocErrors = javadocErr.Error()
	}

	applyJavadocTheme(javadocDir)

	downloads := []GeneratedArtifact{}
	zipName := "javadocFromUmple.zip"
	zipPath := filepath.Join(dir, zipName)
	if err := zipGeneratedArtifacts(zipPath, dir, []string{javadocDir}); err == nil {
		downloads = append(downloads, GeneratedArtifact{
			Label:    "Download Javadoc ZIP",
			URL:      buildGeneratedAssetURL(modelID, zipName),
			Filename: zipName,
		})
	}

	return GenerateResponse{
		Output:    firstNonEmpty(output, "Javadoc generated."),
		Language:  "Java",
		Errors:    firstNonEmpty(strings.TrimSpace(stderr), errString(runErr), javadocErrors),
		ModelID:   modelID,
		Kind:      "iframe",
		IframeURL: buildGeneratedAssetURL(modelID, "javadoc/index.html"),
		Downloads: downloads,
	}, nil
}

func (h *GenerateHandler) generateYuml(dir, modelID string) (GenerateResponse, error) {
	stdout, stderr, runErr := h.runGenerateCommand("Yuml", dir, nil)
	output := strings.TrimSpace(stdout)
	if output == "" {
		if files, _, err := readGeneratedFiles(dir, "Yuml"); err == nil && files != "" {
			output = strings.TrimSpace(files)
		}
	}

	yumlPath := filepath.Join(dir, "yuml.txt")
	if output != "" {
		_ = os.WriteFile(yumlPath, []byte(output), 0o644)
	}

	downloads := []GeneratedArtifact{
		{
			Label:    "Download Yuml Text",
			URL:      buildGeneratedAssetURL(modelID, "yuml.txt"),
			Filename: "yuml.txt",
		},
	}

	imageHTML := ""
	if output != "" {
		pngPath := filepath.Join(dir, "yuml.png")
		if err := fetchYumlPNG(output, pngPath); err == nil {
			downloads = append(downloads, GeneratedArtifact{
				Label:    "Download PNG",
				URL:      buildGeneratedAssetURL(modelID, "yuml.png"),
				Filename: "yuml.png",
			})
			imageHTML = fmt.Sprintf(`<p><img src="%s" alt="Yuml diagram" /></p>`, buildGeneratedAssetURL(modelID, "yuml.png"))
		} else if strings.TrimSpace(stderr) == "" {
			stderr = err.Error()
		}
	}

	html := fmt.Sprintf(
		`<p><a href="%s" target="_blank" rel="noreferrer">Download the Yuml text</a>. You can also render it at <a href="https://yuml.me/diagram/plain/class/draw" target="_blank" rel="noreferrer">yuml.me</a>.</p>%s`,
		buildGeneratedAssetURL(modelID, "yuml.txt"),
		imageHTML,
	)

	if runErr != nil && strings.TrimSpace(stderr) == "" {
		stderr = runErr.Error()
	}

	return GenerateResponse{
		Output:    output,
		Language:  "Yuml",
		Errors:    strings.TrimSpace(stderr),
		ModelID:   modelID,
		Kind:      "html",
		HTML:      html,
		Downloads: downloads,
	}, nil
}

func (h *GenerateHandler) runGenerateCommand(language, dir string, suboptions []string) (string, string, error) {
	args := []string{"-jar", h.jarPath, "-generate", language, filepath.Join(dir, "model.ump")}
	for _, opt := range suboptions {
		args = append(args, "-s", opt)
	}

	cmd := exec.Command("java", args...)
	cmd.Dir = dir

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return stdout.String(), stderr.String(), exitErr
		}
		return stdout.String(), stderr.String(), err
	}
	return stdout.String(), stderr.String(), nil
}

func parseGenerateLanguage(spec string) (string, []string) {
	parts := strings.Split(spec, ".")
	base := parts[0]
	if len(parts) == 1 {
		return base, nil
	}

	suboptions := make([]string, 0, len(parts)-1)
	for _, part := range parts[1:] {
		part = strings.TrimSpace(part)
		if part != "" {
			suboptions = append(suboptions, part)
		}
	}
	return base, suboptions
}

func languageExtensions(lang string) []string {
	switch lang {
	case "Java", "SimulateJava":
		return []string{".java"}
	case "Python":
		return []string{".py"}
	case "Php":
		return []string{".php"}
	case "Ruby":
		return []string{".rb"}
	case "Cpp", "RTCpp", "SimpleCpp":
		return []string{".cpp", ".h"}
	case "Json":
		return []string{".json"}
	case "Sql":
		return []string{".sql"}
	case "Alloy":
		return []string{".als"}
	case "NuSMV":
		return []string{".smv"}
	case "USE":
		return []string{".use"}
	case "Ecore":
		return []string{".ecore"}
	case "TextUml":
		return []string{".tuml"}
	case "Umlet":
		return []string{".uxf"}
	case "Yuml":
		return []string{".yuml"}
	case "Papyrus":
		return []string{".uml", ".notation", ".di", ".project"}
	case "Scxml":
		return []string{".scxml"}
	default:
		return nil
	}
}

func readGeneratedFiles(dir, language string) (string, []string, error) {
	exts := languageExtensions(language)
	if len(exts) == 0 {
		return "", nil, fmt.Errorf("unknown language: %s", language)
	}

	extSet := make(map[string]bool, len(exts))
	for _, ext := range exts {
		extSet[ext] = true
	}

	var paths []string
	filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if extSet[filepath.Ext(path)] && filepath.Base(path) != "model.ump" {
			paths = append(paths, path)
		}
		return nil
	})
	sort.Strings(paths)

	if len(paths) == 0 {
		return "", nil, fmt.Errorf("no generated files found")
	}

	var parts []string
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		parts = append(parts, string(data))
	}

	return strings.Join(parts, "\n"), paths, nil
}

func zipGeneratedArtifacts(zipPath, root string, paths []string) error {
	file, err := os.Create(zipPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := zip.NewWriter(file)

	seen := map[string]bool{}
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		if info.IsDir() {
			filepath.WalkDir(p, func(current string, d os.DirEntry, walkErr error) error {
				if walkErr != nil || d.IsDir() {
					return nil
				}
				addFileToZip(writer, root, current, seen)
				return nil
			})
			continue
		}
		addFileToZip(writer, root, p, seen)
	}

	return writer.Close()
}

func addFileToZip(writer *zip.Writer, root, fullPath string, seen map[string]bool) error {
	relPath, err := filepath.Rel(root, fullPath)
	if err != nil {
		return err
	}
	relPath = filepath.ToSlash(relPath)
	if seen[relPath] {
		return nil
	}
	seen[relPath] = true

	f, err := os.Open(fullPath)
	if err != nil {
		return err
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return err
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = relPath
	header.Method = zip.Deflate

	w, err := writer.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, f)
	return err
}

func buildGeneratedAssetURL(modelID, relPath string) string {
	parts := strings.Split(filepath.ToSlash(relPath), "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return "/api/generated/" + url.PathEscape(modelID) + "/" + strings.Join(parts, "/")
}

func applyJavadocTheme(javadocDir string) {
	marker := "\n/* --- UmpleNext theme overrides --- */\n"
	for _, stylesheet := range []string{
		filepath.Join(javadocDir, "stylesheet.css"),
		filepath.Join(javadocDir, "resources", "stylesheet.css"),
		filepath.Join(javadocDir, "resource-files", "stylesheet.css"),
	} {
		data, err := os.ReadFile(stylesheet)
		if err != nil {
			continue
		}
		if bytes.Contains(data, []byte(marker)) {
			continue
		}
		_ = os.WriteFile(stylesheet, append(data, append([]byte(marker), javadocThemeCSS...)...), 0o644)
	}
}

// fetchYumlPNG renders yUML text to PNG via the yuml.me API and writes it to dst.
func fetchYumlPNG(yumlText, dst string) error {
	encoded := url.PathEscape(yumlText)
	apiURL := "https://yuml.me/diagram/plain/class/" + encoded + ".png"

	resp, err := http.Get(apiURL)
	if err != nil {
		return fmt.Errorf("yuml.me request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("yuml.me returned status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading yuml.me response: %w", err)
	}

	return os.WriteFile(dst, data, 0o644)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
