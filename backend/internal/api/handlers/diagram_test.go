package handlers

import (
	"strings"
	"testing"
)

func TestDiagramTypeInfoIncludesStructureDiagram(t *testing.T) {
	outputKind, ok := diagramTypeInfo["StructureDiagram"]
	if !ok {
		t.Fatal("StructureDiagram should be supported by the diagram handler")
	}

	if outputKind != outputHTML {
		t.Fatalf("StructureDiagram should use HTML output, got %v", outputKind)
	}
}

func TestBuildStructureDiagramHTMLWrapsGeneratedScript(t *testing.T) {
	got := buildStructureDiagramHTML(`ShapesRegistry.paint({ args: { container: "##CANVAS_ID##" } });`)

	if got == "" {
		t.Fatal("expected wrapped HTML, got empty string")
	}
	if !containsAll(got, "svgCanvas", "<svg id=\"svgCanvas\"", "ShapesRegistry.paint", "ObjectsUtil") {
		t.Fatalf("wrapped HTML is missing expected runtime/script content: %s", got)
	}
	if strings.Contains(got, "##CANVAS_ID##") {
		t.Fatalf("expected canvas placeholder to be replaced: %s", got)
	}
}

func containsAll(s string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(s, part) {
			return false
		}
	}
	return true
}
