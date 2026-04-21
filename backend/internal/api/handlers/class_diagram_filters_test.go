package handlers

import (
	"strings"
	"testing"
)

func TestIsValidDiagramSuboptionAcceptsLegacySeparatorValue(t *testing.T) {
	if !isValidDiagramSuboption("gvseparator=1.7") {
		t.Fatal("expected gvseparator=1.7 to be accepted as a valid diagram suboption")
	}
	if isValidDiagramSuboption("gvseparator=0") {
		t.Fatal("expected gvseparator=0 to be rejected")
	}
	if isValidDiagramSuboption("gvseparator=abc") {
		t.Fatal("expected malformed gvseparator value to be rejected")
	}
}

func TestApplyClassDiagramOverlayBuildsLegacyFilterDirectives(t *testing.T) {
	source := "class Invoice {}\n\n//$?[End_of_model]$?\nclass Invoice {\n  position 1 2 3 4;\n}\n"

	overlay, changed := applyClassDiagramOverlay(source, classDiagramOverlayParams{
		classFilterQuery: "Invoice,Quote ~Archived 2 gvseparator=1.7 gvdot",
		namedFilters:     []string{"Focus"},
		mixsets:          []string{"Metrics"},
	}, false)
	if !changed {
		t.Fatal("expected the overlay source to be modified")
	}

	if !strings.Contains(overlay, "use Metrics;") {
		t.Fatalf("expected overlay to activate selected mixsets, got %q", overlay)
	}
	if !strings.Contains(overlay, "filter {includeFilter Focus;}") {
		t.Fatalf("expected overlay to include named filters, got %q", overlay)
	}
	if !strings.Contains(overlay, `suboption "gvseparator=1.7";`) {
		t.Fatalf("expected overlay to include gvseparator suboption, got %q", overlay)
	}
	if !strings.Contains(overlay, "include Invoice,Quote;") || !strings.Contains(overlay, "include ~Archived;") {
		t.Fatalf("expected overlay to include legacy class patterns, got %q", overlay)
	}
	if !strings.Contains(overlay, "hops { association 2;}") {
		t.Fatalf("expected overlay to include hop count filters, got %q", overlay)
	}
	if strings.Contains(overlay, "gvdot") {
		t.Fatalf("expected non-separator gv tokens to stay out of the overlay text box path, got %q", overlay)
	}
	if !strings.Contains(overlay, modelDelimiter) {
		t.Fatalf("expected hidden layout delimiter to be preserved, got %q", overlay)
	}
}

func TestApplyClassDiagramOverlaySkipsFreeFormFilterWhenCodeAlreadyDefinesOne(t *testing.T) {
	source := "filter Existing {\n  include Invoice;\n}\n\nclass Invoice {}\n"

	overlay, changed := applyClassDiagramOverlay(source, classDiagramOverlayParams{
		classFilterQuery: "Invoice 1 gvseparator=1.7",
		namedFilters:     []string{"Focus"},
	}, true)
	if !changed {
		t.Fatal("expected named filters and suboptions to still be applied")
	}

	if strings.Contains(overlay, "hops { association 1;}") || strings.Contains(overlay, "filter { include Invoice;") {
		t.Fatalf("expected free-form filter overlay to be suppressed when code already defines a filter, got %q", overlay)
	}
	if !strings.Contains(overlay, "filter {includeFilter Focus;}") {
		t.Fatalf("expected named filter activation to remain, got %q", overlay)
	}
	if !strings.Contains(overlay, `suboption "gvseparator=1.7";`) {
		t.Fatalf("expected gvseparator to remain active, got %q", overlay)
	}
}

func TestHasExplicitTopLevelFilterIgnoresCommentedFilters(t *testing.T) {
	if hasExplicitTopLevelFilter("// filter Commented {\n//   include Invoice;\n// }\nclass Invoice {}\n") {
		t.Fatal("expected commented filters to be ignored")
	}
	if !hasExplicitTopLevelFilter("filter Existing {\n  include Invoice;\n}\nclass Invoice {}\n") {
		t.Fatal("expected unnamed filters in code to be detected")
	}
}

func TestHasExplicitTopLevelFilterIgnoresNamedFilters(t *testing.T) {
	if hasExplicitTopLevelFilter("filter Focus {\n  include Invoice;\n}\nclass Invoice {}\n") {
		t.Fatal("expected named filters to remain compatible with legacy free-form filtering")
	}
}
